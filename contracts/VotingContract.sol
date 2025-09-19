// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

contract VotingContract {
    struct Election {
        uint256 id;
        string title;
        bool exists;
    }
    
    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(uint256 => uint256)) public voteCounts;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    uint256 public electionCount = 0;
    
    event ElectionCreated(uint256 indexed electionId, string title);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);
    
    function createElection(uint256 _electionId, string memory _title) public {
        elections[_electionId] = Election(_electionId, _title, true);
        electionCount++;
        emit ElectionCreated(_electionId, _title);
    }
    
    function castVote(uint256 _electionId, uint256 _candidateId) public {
        require(elections[_electionId].exists, "Election does not exist");
        require(!hasVoted[_electionId][msg.sender], "Already voted");
        
        hasVoted[_electionId][msg.sender] = true;
        voteCounts[_electionId][_candidateId]++;
        
        emit VoteCast(_electionId, _candidateId, msg.sender);
    }
    
    function getVoteCount(uint256 _electionId, uint256 _candidateId) public view returns (uint256) {
        return voteCounts[_electionId][_candidateId];
    }
    
    function hasUserVoted(uint256 _electionId, address _voter) public view returns (bool) {
        return hasVoted[_electionId][_voter];
    }
}