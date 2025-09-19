# VoteSecure - Blockchain-Based Electronic Voting System

A secure, transparent, and decentralized voting platform built with Node.js, MySQL, and blockchain technology.

## 🚀 Features

- **Blockchain Integration**: Secure vote storage with cryptographic hashing
- **Password Security**: Bcrypt hashing with salt rounds
- **JWT Authentication**: Secure user sessions
- **Role-Based Access**: Admin and Voter dashboards
- **Real-time Results**: Live election monitoring
- **Responsive Design**: Works on all devices

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- Git

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Codesofshravani/VoteSecure.git
   cd VoteSecure
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup MySQL Database**
   - Start MySQL server
   - Run the setup script:
   ```bash
   mysql -u root -p < database/setup.sql
   ```

4. **Configure Environment**
   - Copy `.env` file and update with your settings:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=votesecure
   JWT_SECRET=your_secret_key_here
   PORT=3000
   
   # Blockchain Configuration
   BLOCKCHAIN_NETWORK=http://localhost:8545
   CONTRACT_ADDRESS=0x...
   PRIVATE_KEY=your_private_key_here
   GAS_LIMIT=3000000
   ```

## 🚀 Running the Application

1. **Start the backend server**
   ```bash
   npm start
   ```
   Or for development:
   ```bash
   npm run dev
   ```

2. **Start the frontend**
   ```bash
   npm run client
   ```

3. **Access the application**
   - Frontend: http://localhost:5500
   - Backend API: http://localhost:3000/api

## 👥 Default Users

### Admin Account
- Email: `admin@votesecure.com`
- Password: `admin123`

### Voter Account
- Email: `voter@example.com`
- Password: `voter123`

## 🔐 Security Features

- **Password Hashing**: Bcrypt with 12 salt rounds
- **Blockchain Hashing**: SHA-256 for vote integrity
- **JWT Tokens**: 24-hour expiration
- **SQL Injection Protection**: Parameterized queries
- **CORS Protection**: Configured for security

## 📊 Database Schema

### Users Table
- `id`: Primary key
- `name`: User full name
- `email`: Unique email address
- `password_hash`: Bcrypt hashed password
- `role`: 'admin' or 'voter'
- `blockchain_address`: Ethereum address

### Elections Table
- `id`: Primary key
- `title`: Election title
- `description`: Election description
- `start_date`: Voting start time
- `end_date`: Voting end time
- `status`: 'upcoming', 'active', 'completed'
- `blockchain_hash`: SHA-256 hash

### Votes Table
- `id`: Primary key
- `election_id`: Foreign key to elections
- `candidate_id`: Foreign key to candidates
- `voter_id`: Foreign key to users
- `blockchain_hash`: SHA-256 hash for integrity
- `vote_hash`: Unique vote identifier

## 🔗 API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login

### Elections
- `GET /api/elections` - Get all elections
- `POST /api/elections` - Create election (Admin only)

### Voting
- `POST /api/vote` - Cast vote (Voter only)

## 🧪 Testing

1. Register as admin and create elections
2. Register as voter and participate in voting
3. Monitor real-time results
4. Verify blockchain hashes for integrity

## 🔧 Development

### Project Structure
```
VoteSecure/
├── src/                 # Frontend files
│   ├── pages/          # HTML pages
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── database/           # SQL setup files
├── server.js           # Backend server
├── package.json        # Dependencies
└── .env               # Environment variables
```

### Adding New Features
1. Update database schema in `database/setup.sql`
2. Add API endpoints in `server.js`
3. Update frontend in `src/` directory
4. Test thoroughly before deployment

## 🚀 Deployment

1. Set up production MySQL database
2. Configure environment variables
3. Build and deploy to your server
4. Set up SSL certificates
5. Configure domain and DNS

## 📝 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📞 Support

For support and questions, please create an issue in the repository.