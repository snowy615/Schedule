import { useState, useEffect } from 'react'
import { X, UserPlus, UserX, Users, User } from 'lucide-react'
import apiService from '../services/apiService'
import './SharePlanModal.css'

function SharePlanModal({ plan, onClose, onShareSuccess }) {
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState('read')
  const [sharedUsers, setSharedUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userToShareWith, setUserToShareWith] = useState(null)
  const [lookingUpUser, setLookingUpUser] = useState(false)

  useEffect(() => {
    loadSharedUsers()
  }, [plan.id])

  const loadSharedUsers = async () => {
    try {
      const users = await apiService.getSharedUsers(plan.id)
      setSharedUsers(users)
    } catch (error) {
      console.error('Failed to load shared users:', error)
    }
  }

  const lookupUser = async (email) => {
    if (!email) return null;
    
    try {
      setLookingUpUser(true);
      const user = await apiService.lookupUser(email);
      return user;
    } catch (error) {
      // User not found or other error, that's okay
      return null;
    } finally {
      setLookingUpUser(false);
    }
  }

  const handleShare = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter an email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      await apiService.sharePlan(plan.id, email, permissions)
      setEmail('')
      setPermissions('read')
      setUserToShareWith(null)
      await loadSharedUsers()
      onShareSuccess()
    } catch (error) {
      console.error('Failed to share plan:', error)
      setError(error.message || 'Failed to share plan')
    } finally {
      setLoading(false)
    }
  }

  const handleUnshare = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to stop sharing this plan with ${userEmail}?`)) {
      return
    }

    try {
      await apiService.unsharePlan(plan.id, userEmail)
      await loadSharedUsers()
      onShareSuccess()
    } catch (error) {
      console.error('Failed to unshare plan:', error)
      alert('Failed to unshare plan. Please try again.')
    }
  }

  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleEmailChange = async (e) => {
    const emailValue = e.target.value;
    setEmail(emailValue);
    
    // Clear any previous user info
    setUserToShareWith(null);
    
    // If it's a valid email, look up the user
    if (validateEmail(emailValue)) {
      const user = await lookupUser(emailValue);
      if (user) {
        setUserToShareWith(user);
      } else {
        // If user not found, still show the email as confirmation
        setUserToShareWith({
          email: emailValue,
          name: emailValue.split('@')[0]
        });
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-plan-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Users size={20} />
            Share Plan
          </h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="plan-info">
            <h3>{plan.title}</h3>
            <p>Share this plan with other users.</p>
          </div>

          <form onSubmit={handleShare} className="share-form">
            <div className="form-group">
              <label htmlFor="email">User Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="Enter email address..."
                required
              />
            </div>

            {lookingUpUser && (
              <div className="user-preview loading">
                <div className="user-preview-header">
                  <User size={16} />
                  <span>Looking up user...</span>
                </div>
              </div>
            )}

            {userToShareWith && !lookingUpUser && (
              <div className="user-preview">
                <div className="user-preview-header">
                  <User size={16} />
                  <span>You're sharing with:</span>
                </div>
                <div className="user-preview-content">
                  <span className="user-preview-name">{userToShareWith.name}</span>
                  <span className="user-preview-email">{userToShareWith.email}</span>
                  {!userToShareWith.id && (
                    <span className="user-not-registered">User not registered yet</span>
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="permissions">Permissions</label>
              <select
                id="permissions"
                value={permissions}
                onChange={(e) => setPermissions(e.target.value)}

              >
                <option value="read">View Only</option>
                <option value="write">Collaborate</option>
              </select>
              <p className="permission-note">
                Select the level of access for the shared user.
              </p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button 
                type="button" 
                onClick={onClose} 
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="share-button"
                disabled={loading || !userToShareWith}
              >
                {loading ? 'Sharing...' : (
                  <>
                    <UserPlus size={16} />
                    Share Plan
                  </>
                )}
              </button>
            </div>
          </form>

          {sharedUsers.length > 0 && (
            <div className="shared-users-section">
              <h3>Shared With ({sharedUsers.length})</h3>
              <div className="shared-users-list">
                {sharedUsers.map((user) => (
                  <div key={user.id} className="shared-user-item">
                    <div className="user-info">
                      <div className="user-details">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">({user.email})</span>
                      </div>
                      <div className="shared-date">
                        Shared on {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="user-actions">
                      <span className="permission-badge">
                        {user.permissions === 'write' ? 'Collaborator' : 'Viewer'}
                      </span>
                      <button
                        onClick={() => handleUnshare(user.id, user.email)}
                        className="unshare-button"
                        title={`Stop sharing with ${user.email}`}
                      >
                        <UserX size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SharePlanModal