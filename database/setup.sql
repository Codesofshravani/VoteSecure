-- VoteSecure Database Setup
CREATE DATABASE IF NOT EXISTS votesecure;
USE votesecure;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'voter') NOT NULL,
    blockchain_address VARCHAR(42),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Elections table
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date)
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    blockchain_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    INDEX idx_election (election_id)
);

-- Votes table (blockchain-secured)
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    candidate_id INT NOT NULL,
    voter_id INT NOT NULL,
    blockchain_hash VARCHAR(66) NOT NULL,
    vote_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
    FOREIGN KEY (voter_id) REFERENCES users(id),
    UNIQUE KEY unique_vote (election_id, voter_id),
    INDEX idx_election_votes (election_id),
    INDEX idx_blockchain_hash (blockchain_hash)
);

-- Blockchain transactions log
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    transaction_type ENUM('election_create', 'vote_cast', 'result_publish') NOT NULL,
    related_id INT NOT NULL,
    gas_used BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tx_hash (transaction_hash),
    INDEX idx_type (transaction_type)
);

-- Insert sample admin user (password: admin123)
INSERT IGNORE INTO users (name, email, password_hash, role, blockchain_address) 
VALUES (
    'System Admin', 
    'admin@votesecure.com', 
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..2', 
    'admin',
    '0x742d35Cc6634C0532925a3b8D0C9e3e4C8b4c8d8'
);

-- Sample voter (password: voter123)
INSERT IGNORE INTO users (name, email, password_hash, role, blockchain_address) 
VALUES (
    'John Doe', 
    'voter@example.com', 
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..2', 
    'voter',
    '0x8ba1f109551bD432803012645Hac136c30C6213'
);