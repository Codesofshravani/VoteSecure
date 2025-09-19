// VoteSecure API Integration
const API_BASE_URL = 'http://localhost:3000/api';

class VoteSecureAPI {
    constructor() {
        this.token = localStorage.getItem('authToken');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || 'API request failed';
                } catch {
                    errorMessage = errorText || 'API request failed';
                }
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to server. Make sure the backend is running on port 3005.');
            }
            console.error('API Error:', error);
            throw error;
        }
    }

    async register(userData) {
        return await this.request('/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(credentials) {
        const response = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }

    logout() {
        this.removeToken();
        window.location.href = 'welcome.html';
    }

    async createElection(electionData) {
        return await this.request('/elections', {
            method: 'POST',
            body: JSON.stringify(electionData)
        });
    }

    async getElections() {
        return await this.request('/elections');
    }

    async getDashboardStats() {
        return await this.request('/dashboard/stats');
    }

    async castVote(voteData) {
        return await this.request('/vote', {
            method: 'POST',
            body: JSON.stringify(voteData)
        });
    }

    async getVoters() {
        return await this.request('/voters');
    }

    async deleteVoter(voterId) {
        return await this.request(`/voters/${voterId}`, {
            method: 'DELETE'
        });
    }

    async deleteElection(electionId) {
        console.log('API: Deleting election with ID:', electionId);
        const response = await this.request(`/elections/${electionId}`, {
            method: 'DELETE'
        });
        console.log('API: Delete response:', response);
        return response;
    }

    async updateElectionStatus() {
        return await this.request('/elections/update-status', {
            method: 'POST'
        });
    }

    async getVotingHistory() {
        return await this.request('/votes/history');
    }
}

const api = new VoteSecureAPI();

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    let backgroundColor;
    switch(type) {
        case 'error':
            backgroundColor = '#e53e3e';
            break;
        case 'success':
            backgroundColor = '#38a169';
            break;
        default:
            backgroundColor = '#3182ce';
    }
    
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 9999;
        background: ${backgroundColor};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Add CSS animations
if (!document.querySelector('#message-animations')) {
    const style = document.createElement('style');
    style.id = 'message-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

function getUserInfo() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (error) {
        return null;
    }
}

window.api = api;
window.showMessage = showMessage;
window.isAuthenticated = isAuthenticated;
window.getUserInfo = getUserInfo;