const { Web3 } = require('web3');
const contractInfo = require('./blockchain/contract-info.json');

async function testBlockchain() {
    try {
        const web3 = new Web3('http://localhost:8545');
        const accounts = await web3.eth.getAccounts();
        console.log('Connected to Ganache, accounts:', accounts.length);
        
        const contract = new web3.eth.Contract(contractInfo.abi, contractInfo.address);
        console.log('Contract loaded at:', contractInfo.address);
        
        // Test creating an election
        console.log('Creating test election...');
        const tx1 = await contract.methods.createElection(999, "Test Election").send({
            from: accounts[0],
            gas: 300000
        });
        console.log('Election created, tx:', tx1.transactionHash);
        
        // Test voting
        console.log('Casting test vote...');
        const tx2 = await contract.methods.castVote(999, 1).send({
            from: accounts[1],
            gas: 300000
        });
        console.log('Vote cast, tx:', tx2.transactionHash);
        
        // Check vote count
        const voteCount = await contract.methods.getVoteCount(999, 1).call();
        console.log('Vote count for candidate 1:', voteCount);
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testBlockchain();