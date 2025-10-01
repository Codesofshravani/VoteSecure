const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('src'));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Web3 setup (optional)
let web3 = null;
try {
  if (process.env.BLOCKCHAIN_NETWORK) {
    const { Web3 } = require('web3');
    web3 = new Web3(process.env.BLOCKCHAIN_NETWORK);
  }
} catch (error) {
  console.log('Web3 not available, running without blockchain');
}

// Database initialization
async function initDatabase() {
  try {
    // First connect without database to create it
    const tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
    
    // Create database if not exists
    await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    await tempConnection.end();
    
    // Now connect to the specific database
    const connection = await mysql.createConnection(dbConfig);
    
    // Create tables only if they don't exist (preserve existing data)
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'voter') NOT NULL,
        blockchain_address VARCHAR(42),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS elections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status ENUM('upcoming', 'active', 'completed') DEFAULT 'upcoming',
        blockchain_hash VARCHAR(66),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        election_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        blockchain_hash VARCHAR(66),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS votes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        election_id INT NOT NULL,
        candidate_id INT NOT NULL,
        voter_id INT NOT NULL,
        blockchain_hash VARCHAR(66) NOT NULL,
        vote_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
        FOREIGN KEY (voter_id) REFERENCES users(id),
        UNIQUE KEY unique_vote (election_id, voter_id)
      )
    `);
    
    await connection.end();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Blockchain utilities
function generateBlockchainHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function generateVoteHash(voterId, candidateId, timestamp) {
  return crypto.createHash('sha256').update(`${voterId}-${candidateId}-${timestamp}`).digest('hex');
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Routes

// Password validation function
function validatePassword(password) {
  const minLength = 6;
  const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
  
  if (password.length < minLength) {
    return "Password must be at least 6 characters long";
  }
  
  if (!specialCharRegex.test(password)) {
    return "Password must contain at least one special character";
  }
  
  return null; // Valid password
}

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if user exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existing.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Generate blockchain address
    let blockchainAddress = null;
    if (web3) {
      try {
        const account = web3.eth.accounts.create();
        blockchainAddress = account.address;
      } catch (error) {
        console.log('Blockchain address generation failed, using null');
      }
    }
    
    // Insert user
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password_hash, role, blockchain_address) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, role, blockchainAddress]
    );
    
    await connection.end();
    
    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId,
      blockchainAddress
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: `Registration failed: ${error.message}` });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(
      'SELECT id, name, email, password_hash, role, blockchain_address FROM users WHERE email = ?',
      [email]
    );
    
    await connection.end();
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        blockchainAddress: user.blockchain_address
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Election (Admin only)
app.post('/api/elections', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { title, description, startDate, endDate, candidates } = req.body;
    
    // Validate title is not empty or just dashes/spaces
    if (!title || title.trim() === "" || title.trim() === "-" || title.trim().replace(/[-\s]/g, "") === "") {
      return res.status(400).json({ error: 'Valid election title is required' });
    }
    
    // Validate description if provided
    if (description && (description.trim() === "-" || description.trim().replace(/[-\s]/g, "") === "")) {
      return res.status(400).json({ error: 'Valid description required or leave empty' });
    }
    
    if (!startDate || !endDate || !candidates || candidates.length === 0) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }
    
    // Validate candidates
    for (const candidate of candidates) {
      if (!candidate.name || candidate.name.trim() === "" || candidate.name.trim() === "-" || candidate.name.trim().replace(/[-\s]/g, "") === "") {
        return res.status(400).json({ error: 'All candidates must have valid names' });
      }
      if (candidate.description && (candidate.description.trim() === "-" || candidate.description.trim().replace(/[-\s]/g, "") === "")) {
        return res.status(400).json({ error: 'Candidate descriptions must be valid or empty' });
      }
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Generate blockchain hash for election
    const electionData = { title, description, startDate, endDate, createdBy: req.user.userId };
    const blockchainHash = generateBlockchainHash(electionData);
    
    // Insert election
    const [electionResult] = await connection.execute(
      'INSERT INTO elections (title, description, start_date, end_date, blockchain_hash, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, startDate, endDate, blockchainHash, req.user.userId]
    );
    
    const electionId = electionResult.insertId;
    
    // Create election on blockchain if available
    if (web3) {
      try {
        const contractInfo = require('./blockchain/contract-info.json');
        const contract = new web3.eth.Contract(contractInfo.abi, contractInfo.address);
        const accounts = await web3.eth.getAccounts();
        
        await contract.methods.createElection(electionId, title).send({
          from: accounts[0],
          gas: 300000
        });
        
        console.log('Election created on blockchain:', electionId);
      } catch (blockchainError) {
        console.log('Blockchain election creation failed:', blockchainError.message);
      }
    }
    
    // Insert candidates
    for (const candidate of candidates) {
      const candidateHash = generateBlockchainHash({ name: candidate.name, electionId });
      // Only insert description if it's not empty or null
      const description = candidate.description && candidate.description.trim() ? candidate.description.trim() : null;
      await connection.execute(
        'INSERT INTO candidates (election_id, name, description, blockchain_hash) VALUES (?, ?, ?, ?)',
        [electionId, candidate.name, description, candidateHash]
      );
    }
    
    await connection.end();
    
    res.status(201).json({
      message: 'Election created successfully',
      electionId,
      blockchainHash
    });
    
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cast Vote
app.post('/api/vote', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'voter') {
      return res.status(403).json({ error: 'Voter access required' });
    }
    
    const { electionId, candidateId } = req.body;
    
    if (!electionId || !candidateId) {
      return res.status(400).json({ error: 'Election ID and Candidate ID are required' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Update election status first
    await connection.execute(`
      UPDATE elections 
      SET status = CASE 
        WHEN start_date > NOW() THEN 'upcoming'
        WHEN start_date <= NOW() AND end_date > NOW() THEN 'active'
        WHEN end_date <= NOW() THEN 'completed'
        ELSE status
      END
      WHERE id = ?
    `, [electionId]);
    
    // Check if election is active
    const [elections] = await connection.execute(
      'SELECT status FROM elections WHERE id = ?',
      [electionId]
    );
    
    if (elections.length === 0 || elections[0].status !== 'active') {
      await connection.end();
      return res.status(400).json({ error: 'Election is not active' });
    }
    
    // Check if user already voted
    const [existingVotes] = await connection.execute(
      'SELECT id FROM votes WHERE election_id = ? AND voter_id = ?',
      [electionId, req.user.userId]
    );
    
    if (existingVotes.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'You have already voted in this election' });
    }
    
    // Cast vote on blockchain if available
    let blockchainTxHash = null;
    if (web3) {
      try {
        const contractInfo = require('./blockchain/contract-info.json');
        const contract = new web3.eth.Contract(contractInfo.abi, contractInfo.address);
        const accounts = await web3.eth.getAccounts();
        
        const tx = await contract.methods.castVote(electionId, candidateId).send({
          from: accounts[0],
          gas: 300000
        });
        
        blockchainTxHash = tx.transactionHash;
        console.log('Blockchain vote cast:', blockchainTxHash);
      } catch (blockchainError) {
        console.log('Blockchain vote failed, continuing with database only:', blockchainError.message);
      }
    }
    
    // Generate vote hash and blockchain hash
    const timestamp = Date.now();
    const voteHash = generateVoteHash(req.user.userId, candidateId, timestamp);
    const blockchainHash = blockchainTxHash || generateBlockchainHash({ electionId, candidateId, voterId: req.user.userId, timestamp });
    
    // Insert vote
    await connection.execute(
      'INSERT INTO votes (election_id, candidate_id, voter_id, blockchain_hash, vote_hash) VALUES (?, ?, ?, ?, ?)',
      [electionId, candidateId, req.user.userId, blockchainHash, voteHash]
    );
    
    await connection.end();
    
    res.json({
      message: 'Vote cast successfully',
      voteHash,
      blockchainHash,
      blockchainTx: blockchainTxHash
    });
    
  } catch (error) {
    console.error('Vote casting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Elections with real-time vote counts
app.get('/api/elections', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Update election statuses based on current time
    await connection.execute(`
      UPDATE elections 
      SET status = CASE 
        WHEN start_date > NOW() THEN 'upcoming'
        WHEN start_date <= NOW() AND end_date > NOW() THEN 'active'
        WHEN end_date <= NOW() THEN 'completed'
        ELSE status
      END
    `);
    
    const [elections] = await connection.execute(`
      SELECT e.*, u.name as created_by_name,
             (SELECT COUNT(*) FROM votes v WHERE v.election_id = e.id) as total_votes,
             (SELECT COUNT(DISTINCT v.voter_id) FROM votes v WHERE v.election_id = e.id) as unique_voters
      FROM elections e
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.created_at DESC
    `);
    
    // Get candidate vote counts for each election
    for (let election of elections) {
      const [candidates] = await connection.execute(`
        SELECT c.*, 
               (SELECT COUNT(*) FROM votes v WHERE v.candidate_id = c.id) as vote_count
        FROM candidates c 
        WHERE c.election_id = ?
        ORDER BY vote_count DESC
      `, [election.id]);
      
      election.candidates = candidates;
    }
    
    await connection.end();
    
    res.json(elections);
    
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Get election counts
    const [electionStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_elections,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_elections,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_elections
      FROM elections
    `);
    
    // Get voter count
    const [voterStats] = await connection.execute(`
      SELECT COUNT(*) as total_voters FROM users WHERE role = 'voter'
    `);
    
    // Get total votes
    const [voteStats] = await connection.execute(`
      SELECT COUNT(*) as total_votes FROM votes
    `);
    
    await connection.end();
    
    res.json({
      elections: electionStats[0],
      voters: voterStats[0].total_voters,
      votes: voteStats[0].total_votes
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all voters (Admin only)
app.get('/api/voters', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    const [voters] = await connection.execute(`
      SELECT u.id, u.name, u.email, u.created_at,
             COUNT(v.id) as votes_cast
      FROM users u
      LEFT JOIN votes v ON u.id = v.voter_id
      WHERE u.role = 'voter'
      GROUP BY u.id, u.name, u.email, u.created_at
      ORDER BY u.created_at DESC
    `);
    
    await connection.end();
    res.json(voters);
    
  } catch (error) {
    console.error('Get voters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete voter (Admin only)
app.delete('/api/voters/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const voterId = req.params.id;
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if voter has cast any votes
    const [votes] = await connection.execute(
      'SELECT COUNT(*) as vote_count FROM votes WHERE voter_id = ?',
      [voterId]
    );
    
    if (votes[0].vote_count > 0) {
      await connection.end();
      return res.status(400).json({ error: 'Cannot delete voter who has cast votes' });
    }
    
    // Delete voter
    const [result] = await connection.execute(
      'DELETE FROM users WHERE id = ? AND role = "voter"',
      [voterId]
    );
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Voter not found' });
    }
    
    res.json({ message: 'Voter deleted successfully' });
    
  } catch (error) {
    console.error('Delete voter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete election (Admin only)
app.delete('/api/elections/:id', authenticateToken, async (req, res) => {
  try {
    console.log('DELETE /api/elections/:id called by user:', req.user.email, 'role:', req.user.role);
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const electionId = req.params.id;
    console.log('Attempting to delete election ID:', electionId);
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if election has votes
    const [votes] = await connection.execute(
      'SELECT COUNT(*) as vote_count FROM votes WHERE election_id = ?',
      [electionId]
    );
    
    console.log('Vote count for election:', votes[0].vote_count);
    
    if (votes[0].vote_count > 0) {
      await connection.end();
      return res.status(400).json({ error: 'Cannot delete election with existing votes' });
    }
    
    // Delete election (candidates will be deleted automatically due to CASCADE)
    const [result] = await connection.execute(
      'DELETE FROM elections WHERE id = ?',
      [electionId]
    );
    
    console.log('Delete result:', result);
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Election not found' });
    }
    
    console.log('Election deleted successfully');
    res.json({ message: 'Election deleted successfully' });
    
  } catch (error) {
    console.error('Delete election error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Get voting history for current user
app.get('/api/votes/history', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [votes] = await connection.execute(`
      SELECT v.*, e.title as election_title, e.description as election_description
      FROM votes v
      JOIN elections e ON v.election_id = e.id
      WHERE v.voter_id = ?
      ORDER BY v.created_at DESC
    `, [req.user.userId]);
    
    await connection.end();
    res.json(votes);
    
  } catch (error) {
    console.error('Get voting history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint to check all data
app.get('/api/debug', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute('SELECT id, name, email, role FROM users');
    const [elections] = await connection.execute('SELECT *, NOW() as current_time FROM elections');
    const [votes] = await connection.execute('SELECT * FROM votes');
    
    await connection.end();
    
    res.json({ users, elections, votes, serverTime: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force update election status
app.post('/api/elections/update-status', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.execute(`
      UPDATE elections 
      SET status = CASE 
        WHEN start_date > NOW() THEN 'upcoming'
        WHEN start_date <= NOW() AND end_date > NOW() THEN 'active'
        WHEN end_date <= NOW() THEN 'completed'
        ELSE status
      END
    `);
    
    const [elections] = await connection.execute('SELECT * FROM elections');
    await connection.end();
    
    res.json({ message: 'Status updated', elections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`VoteSecure server running on port ${PORT}`);
    console.log(`Frontend: http://localhost:5500`);
    console.log(`API: http://localhost:${PORT}/api`);
  });
});

module.exports = app;