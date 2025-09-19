const { Web3 } = require('web3');
const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Connect to Ganache
const web3 = new Web3('http://localhost:8545');

async function deployContract() {
    try {
        // Read contract source
        const contractPath = path.join(__dirname, '../contracts/VotingContract.sol');
        const source = fs.readFileSync(contractPath, 'utf8');
        
        // Compile contract
        const input = {
            language: 'Solidity',
            sources: {
                'VotingContract.sol': {
                    content: source,
                },
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['*'],
                    },
                },
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            },
        };
        
        const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
        
        if (compiled.errors) {
            console.log('Compilation errors:', compiled.errors);
        }
        
        const contract = compiled.contracts['VotingContract.sol']['VotingContract'];
        
        // Get accounts
        const accounts = await web3.eth.getAccounts();
        console.log('Deploying from account:', accounts[0]);
        
        // Deploy contract
        const deployedContract = await new web3.eth.Contract(contract.abi)
            .deploy({
                data: '0x' + contract.evm.bytecode.object,
            })
            .send({
                from: accounts[0],
                gas: 5000000,
                gasPrice: '20000000000'
            });
        
        console.log('Contract deployed at:', deployedContract.options.address);
        
        // Save contract info
        const contractInfo = {
            address: deployedContract.options.address,
            abi: contract.abi,
        };
        
        fs.writeFileSync(
            path.join(__dirname, 'contract-info.json'),
            JSON.stringify(contractInfo, null, 2)
        );
        
        return contractInfo;
    } catch (error) {
        console.error('Deployment error:', error);
    }
}

if (require.main === module) {
    deployContract();
}

module.exports = { deployContract };