import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

// ====================================================================
// MAIN APP
// ====================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [appMode, setAppMode] = useState('feed'); // feed | messages | map | war | admin | profile

  useEffect(() => {
    fetch('/api/maintenance-status')
      .then(r => r.json())
      .then(d => setMaintenance(d.maintenance_mode === 'on'))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loginWrap}><p style={{ color: '#888' }}>Loading...</p></div>;
  if (!user) return <LoginScreen setUser={setUser} maintenance={maintenance} />;

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <h1 style={{ color: '#e94560', margin: 0, fontSize: 20 }}>🚀 Hub App</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: user.role === 'admin' ? '#f39c12' : '#fff', fontSize: 13 }}>
            {user.role === 'admin' && '🛡️ '}{user.display_name || user.username}
          </span>
          <button style={styles.smallBtn} onClick={() => setUser(null)}>Logout</button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={styles.tabs}>
        <button style={{ ...styles.tab, borderBottom: appMode === 'feed' ? '3px solid #e94560' : '3px solid transparent' }}
          onClick={() => setAppMode('feed')}>📱 Feed</button>
        <button style={{ ...styles.tab, borderBottom: appMode === 'messages' ? '3px solid #e94560' : '3px solid transparent' }}
          onClick={() => setAppMode('messages')}>💬 Messages</button>
        <button style={{ ...styles.tab, borderBottom: appMode === 'map' ? '3px solid #e94560' : '3px solid transparent' }}
          onClick={() => setAppMode('map')}>🗺️ Map</button>
        <button style={{ ...styles.tab, borderBottom: appMode === 'war' ? '3px solid #e94560' : '3px solid transparent' }}
          onClick={() => setAppMode('war')}>⚔️ War</button>
        <button style={{ ...styles.tab, borderBottom: appMode === 'profile' ? '3px solid #e94560' : '3px solid transparent' }}
          onClick={() => setAppMode('profile')}>👤 Profile</button>
        {user.role === 'admin' && (
          <button style={{ ...styles.tab, borderBottom: appMode === 'admin' ? '3px solid #f39c12' : '3px solid transparent', color: '#f39c12' }}
            onClick={() => setAppMode('admin')}>⚙️ Admin</button>
        )}
      </div>

      {/* Content Area */}
      <div style={styles.content}>
        {appMode === 'feed' && <SocialFeed user={user} />}
        {appMode === 'messages' && <MessagesPanel user={user} />}
        {appMode === 'map' && <SocialMap user={user} />}
        {appMode === 'war' && <WarGame user={user} />}
        {appMode === 'profile' && <ProfileView userId={user.id} currentUser={user} />}
        {appMode === 'admin' && user.role === 'admin' && <AdminPanel admin={user} />}
      </div>
    </div>
  );
}

// ====================================================================
// LOGIN SCREEN (from social-app)
// ====================================================================
function LoginScreen({ setUser, maintenance }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUser, setForgotUser] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [changePass, setChangePass] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'MAINTENANCE') {
          setError('🔧 App is under maintenance. Only admin can access.');
          return;
        }
        setError(data.error || 'Login failed');
        return;
      }
      if (data.must_change_password) {
        setChangePass(data);
        return;
      }
      setUser(data);
    } catch (err) {
      setError('Connection error');
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPass.length < 4) { setError('Password must be at least 4 characters'); return; }
    if (newPass !== confirmPass) { setError('Passwords do not match'); return; }
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: changePass.id, current_password: password, new_password: newPass })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setUser({ ...changePass, must_change_password: false });
    setChangePass(null);
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!forgotUser.trim()) return;
    const res = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: forgotUser.trim() })
    });
    const data = await res.json();
    setForgotMsg(data.message || data.error || 'Request sent');
  }

  // Quick map login
  async function handleQuickLogin(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/map-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });
      const data = await res.json();
      setUser(data);
    } catch (err) {
      setError('Connection error');
    }
  }

  if (changePass) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginBox}>
          <h1 style={{ color: '#e94560', marginBottom: 5 }}>🔐 Change Password</h1>
          <p style={{ color: '#aaa', marginBottom: 15, fontSize: 13 }}>
            Welcome {changePass.display_name || changePass.username}! You must change your default password.
          </p>
          {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input style={styles.input} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New password (min 4 chars)" required />
            <input style={styles.input} type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Confirm new password" required />
            <button style={styles.btn} type="submit">Change & Continue</button>
          </form>
        </div>
      </div>
    );
  }

  if (showForgot) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginBox}>
          <h1 style={{ color: '#e94560', marginBottom: 5 }}>🔑 Forgot Password</h1>
          {forgotMsg && <p style={{ color: '#2ecc71', fontSize: 13, marginBottom: 10 }}>{forgotMsg}</p>}
          {!forgotMsg && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ color: '#aaa', fontSize: 13, marginBottom: 5 }}>Enter your username. A reset request will be sent to admin.</p>
              <input style={styles.input} value={forgotUser} onChange={e => setForgotUser(e.target.value)} placeholder="Your username" required />
              <button style={styles.btn} type="submit">Send Request</button>
            </form>
          )}
          <button style={{ ...styles.smallBtn, marginTop: 12 }} onClick={() => { setShowForgot(false); setForgotMsg(''); }}>← Back to login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.loginWrap}>
      <div style={styles.loginBox}>
        <h1 style={{ color: '#e94560', fontSize: 28, marginBottom: 5 }}>🚀 Hub App</h1>
        <p style={{ color: '#888', marginBottom: 15, fontSize: 13 }}>All-in-One Social Platform + Games</p>
        {maintenance && (
          <div style={{ background: '#e9456033', border: '1px solid #e94560', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#e94560' }}>
            🔧 Under maintenance — admin access only
          </div>
        )}
        {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{error}</p>}

        {/* Login with password */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ color: '#fff', margin: '5px 0', fontSize: 14 }}>Login</h3>
          <input style={styles.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required />
          <input style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
          <button style={styles.btn} type="submit">Login</button>
        </form>

        <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginTop: 10, fontSize: 12, textDecoration: 'underline' }}
          onClick={() => setShowForgot(true)}>Forgot password?</button>

        <div style={{ borderTop: '1px solid #333', margin: '15px 0 10px 0' }} />

        {/* Quick join (no password - for map style) */}
        <form onSubmit={handleQuickLogin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ color: '#888', margin: 0, fontSize: 13 }}>Quick Join (no password)</h3>
          <button style={{ ...styles.btn, background: '#2ecc71' }} type="submit">Join with username above</button>
        </form>
      </div>
    </div>
  );
}

// ====================================================================
// SOCIAL FEED (from social-app)
// ====================================================================
function SocialFeed({ user }) {
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [tab, setTab] = useState('feed');
  const [viewUser, setViewUser] = useState(null);

  async function fetchPosts(followingOnly = false) {
    let url = '/api/posts';
    if (followingOnly && user) url += `?following=true&user_id=${user.id}`;
    const res = await fetch(url);
    setPosts(await res.json());
  }

  async function fetchUsers() {
    const res = await fetch('/api/users');
    setUsers(await res.json());
  }

  async function fetchFollowing() {
    if (!user) return;
    const res = await fetch(`/api/users/${user.id}/following`);
    setFollowing(await res.json());
  }

  useEffect(() => { fetchPosts(); fetchUsers(); fetchFollowing(); }, [user]);

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim()) return;
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, content: newPost })
    });
    const post = await res.json();
    setPosts(prev => [post, ...prev]);
    setNewPost('');
  }

  async function handleLike(postId) {
    await fetch(`/api/posts/${postId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    fetchPosts(tab === 'following');
  }

  async function handleDelete(postId) {
    await fetch(`/api/posts/${postId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  async function handleFollow(userId) {
    await fetch(`/api/users/${userId}/follow`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    fetchFollowing();
    fetchUsers();
  }

  return (
    <div style={{ flex: 1, maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <h3 style={{ color: '#fff', marginBottom: 15 }}>📱 Social Feed</h3>

      {/* Feed Tabs */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
        <button style={tab === 'feed' ? styles.activeTabBtn : styles.tabBtn} onClick={() => { setTab('feed'); fetchPosts(false); setViewUser(null); }}>Feed</button>
        <button style={tab === 'following' ? styles.activeTabBtn : styles.tabBtn} onClick={() => { setTab('following'); fetchPosts(true); setViewUser(null); }}>Following</button>
        <button style={tab === 'people' ? styles.activeTabBtn : styles.tabBtn} onClick={() => { setTab('people'); fetchUsers(); setViewUser(null); }}>People</button>
      </div>

      {(tab === 'feed' || tab === 'following') && (
        <div>
          {tab === 'feed' && (
            <form onSubmit={handlePost} style={styles.composer}>
              <textarea style={styles.textarea} value={newPost} onChange={e => setNewPost(e.target.value)}
                placeholder="What's on your mind?" maxLength={280} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: newPost.length > 260 ? (newPost.length > 280 ? '#e74c3c' : '#f39c12') : '#666', fontSize: 12 }}>
                  {newPost.length}/280
                </span>
                <button style={styles.btn} type="submit">Post</button>
              </div>
            </form>
          )}
          {posts.length === 0 && <p style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>No posts yet.</p>}
          {posts.map(post => (
            <div key={post.id} style={styles.post}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' }}
                    onClick={() => setViewUser(post.user_id)}>{post.display_name || post.username}</span>
                  <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>@{post.username} · {timeAgo(post.created_at)}</span>
                </div>
                {post.user_id === user.id && (
                  <button style={styles.deleteBtn} onClick={() => handleDelete(post.id)}>✕</button>
                )}
              </div>
              <p style={{ color: '#ddd', margin: '8px 0', fontSize: 14, lineHeight: 1.4 }}>{post.content}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <button style={{ background: 'none', border: 'none', color: '#e94560', cursor: 'pointer', fontSize: 14, padding: 0 }}
                  onClick={() => handleLike(post.id)}>❤️</button>
                <span style={{ color: '#aaa', fontSize: 12 }}>{post.like_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'people' && (
        <div>
          {users.filter(u => u.id !== user.id).map(u => (
            <div key={u.id} style={styles.userCard}>
              <div>
                <span style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' }}
                  onClick={() => setViewUser(u.id)}>{u.display_name || u.username}</span>
                <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>@{u.username}</span>
                <div style={{ color: '#666', fontSize: 11, marginTop: 3 }}>
                  📝 {u.post_count} posts · 👥 {u.follower_count} followers · {u.following_count} following
                </div>
              </div>
              <button style={following.includes(u.id) ? { ...styles.followBtn, background: '#333', color: '#888' } : styles.followBtn}
                onClick={() => handleFollow(u.id)}>{following.includes(u.id) ? 'Unfollow' : 'Follow'}</button>
            </div>
          ))}
        </div>
      )}

      {/* Profile modal */}
      {viewUser && <UserProfileModal userId={viewUser} currentUser={user} onClose={() => setViewUser(null)} onFollow={handleFollow} following={following} />}
    </div>
  );
}

// ====================================================================
// MESSAGING PANEL
// ====================================================================
function MessagesPanel({ user }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, [user]);

  async function fetchConversations() {
    const res = await fetch(`/api/conversations?user_id=${user.id}`);
    setConversations(await res.json());
  }

  async function fetchUsers() {
    const res = await fetch('/api/users');
    const all = await res.json();
    setUsers(all.filter(u => u.id !== user.id));
  }

  async function fetchMessages(conversation) {
    if (!conversation) return;
    const res = await fetch(`/api/conversations/${conversation.id}/messages`);
    setMessages(await res.json());
    setSelectedConversation(conversation);
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;
    const res = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, text: messageText.trim() })
    });
    if (!res.ok) {
      const err = await res.json();
      setStatus(err.error || 'Unable to send message');
      return;
    }
    setMessageText('');
    setStatus('');
    fetchMessages(selectedConversation);
    fetchConversations();
  }

  async function startConversation(partner) {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, participant_id: partner.id })
    });
    if (!res.ok) {
      const err = await res.json();
      setStatus(err.error || 'Unable to start conversation');
      return;
    }
    const data = await res.json();
    const conversation = {
      id: data.id,
      other_id: partner.id,
      other_username: partner.username,
      other_display_name: partner.display_name || partner.username,
      last_text: '',
      last_message_at: new Date().toISOString()
    };
    fetchConversations();
    fetchMessages(conversation);
  }

  const filteredUsers = searchText
    ? users.filter(u => u.display_name.toLowerCase().includes(searchText.toLowerCase()) || u.username.toLowerCase().includes(searchText.toLowerCase()))
    : users;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: '100%', gap: 16 }}>
      <div style={styles.sidebar}>
        <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>💬 Conversations</h3>
        <input
          style={styles.input}
          placeholder="Search users to chat"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 10 }}>
          {filteredUsers.map(userItem => (
            <div key={userItem.id} style={styles.userCard}>
              <div>
                <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{userItem.display_name || userItem.username}</div>
                <div style={{ color: '#888', fontSize: 11 }}>@{userItem.username}</div>
              </div>
              <button
                style={{ ...styles.followBtn, padding: '5px 10px', fontSize: 11 }}
                onClick={() => startConversation(userItem)}
              >Chat</button>
            </div>
          ))}
          {filteredUsers.length === 0 && <p style={{ color: '#666', fontSize: 12 }}>No users found.</p>}
        </div>

        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: '#fff', margin: '0 0 10px 0' }}>Recent</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conversations.map(conv => (
              <button
                key={conv.id}
                style={{
                  ...styles.tabBtn,
                  textAlign: 'left',
                  background: selectedConversation?.id === conv.id ? '#333' : '#2a2a3e'
                }}
                onClick={() => fetchMessages(conv)}
              >
                <div style={{ color: '#fff', fontWeight: 'bold' }}>{conv.other_display_name || conv.other_username}</div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{conv.last_text || 'New conversation'}</div>
              </button>
            ))}
            {conversations.length === 0 && <p style={{ color: '#666', fontSize: 12 }}>No conversations yet.</p>}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...styles.post, flex: '0 0 auto', marginBottom: 10 }}>
          <h3 style={{ color: '#fff', margin: 0 }}>Messaging</h3>
          <p style={{ color: '#888', fontSize: 12, margin: '6px 0 0 0' }}>
            Start a conversation with any user and send messages one-on-one.
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, borderRadius: 12, background: '#151525', border: '1px solid #222' }}>
          {!selectedConversation && (
            <div style={{ color: '#aaa', textAlign: 'center', paddingTop: 40 }}>
              Select a conversation or start a new chat from the list on the left.
            </div>
          )}

          {selectedConversation && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{selectedConversation.other_display_name || selectedConversation.other_username}</div>
                <div style={{ color: '#888', fontSize: 12 }}>@{selectedConversation.other_username}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0 && <p style={{ color: '#666', marginTop: 20 }}>No messages yet. Say hello!</p>}
                {messages.map(msg => (
                  <div key={msg.id} style={{
                    ...styles.messageBubble,
                    alignSelf: msg.sender_id === user.id ? 'flex-end' : 'flex-start',
                    background: msg.sender_id === user.id ? '#e94560' : '#2a2a3e'
                  }}>
                    <div style={{ color: '#fff', fontSize: 12, marginBottom: 4 }}>
                      {msg.sender_id === user.id ? 'You' : msg.display_name || msg.username}
                    </div>
                    <div style={{ color: '#fff', fontSize: 14, whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                    <div style={{ color: '#aaa', fontSize: 11, marginTop: 6 }}>{timeAgo(msg.created_at)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {selectedConversation && (
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end' }}>
            <textarea
              style={{ ...styles.textarea, flex: 1, minHeight: 60, margin: 0 }}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Type your message..."
            />
            <button style={{ ...styles.btn, minWidth: 110 }} type="submit">Send</button>
          </form>
        )}
        {status && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 8 }}>{status}</p>}
      </div>
    </div>
  );
}

// ====================================================================
// USER PROFILE MODAL
// ====================================================================
function UserProfileModal({ userId, currentUser, onClose, onFollow, following }) {
  const [profile, setProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setProfile);
    fetch(`/api/posts?user_id=${userId}`).then(r => r.json()).then(setUserPosts);
  }, [userId]);

  if (!profile) return null;
  const isOwn = profile.id === currentUser.id;
  const isFollowing = following.includes(profile.id);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }} onClick={onClose}>✕</button>
        <h2 style={{ color: '#fff', margin: '0 0 5px 0' }}>{profile.display_name || profile.username}</h2>
        <p style={{ color: '#888', margin: '0 0 10px 0', fontSize: 13 }}>@{profile.username}</p>
        {!isOwn && (
          <button style={isFollowing ? { ...styles.followBtn, background: '#333', color: '#888' } : styles.followBtn}
            onClick={() => onFollow(profile.id)}>{isFollowing ? 'Unfollow' : 'Follow'}</button>
        )}
        <div style={{ display: 'flex', gap: 15, marginTop: 10, color: '#aaa', fontSize: 13 }}>
          <span>📝 {profile.post_count} posts</span>
          <span>👥 {profile.follower_count} followers</span>
          <span>{profile.following_count} following</span>
        </div>
        <hr style={{ border: '1px solid #333', margin: '12px 0' }} />
        <h4 style={{ color: '#fff', margin: '0 0 8px 0' }}>Posts</h4>
        {userPosts.length === 0 && <p style={{ color: '#666' }}>No posts yet</p>}
        {userPosts.map(post => (
          <div key={post.id} style={{ ...styles.post, marginBottom: 8 }}>
            <p style={{ color: '#ddd', margin: '0 0 5px 0', fontSize: 13 }}>{post.content}</p>
            <span style={{ color: '#888', fontSize: 11 }}>❤️ {post.like_count} · {timeAgo(post.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ====================================================================
// SOCIAL MAP (from social-map)
// ====================================================================
function SocialMap({ user }) {
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPin, setNewPin] = useState({ lat: 0, lng: 0 });
  const [form, setForm] = useState({ title: '', description: '' });
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  async function fetchPins() {
    const res = await fetch('/api/pins');
    setPins(await res.json());
  }

  async function fetchComments(pinId) {
    const res = await fetch(`/api/pins/${pinId}/comments`);
    setComments(await res.json());
  }

  useEffect(() => { fetchPins(); }, []);

  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;
    const map = L.map(mapRef.current).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', (e) => {
      if (!user) return;
      setNewPin({ lat: e.latlng.lat, lng: e.latlng.lng });
      setShowAddForm(true);
      setForm({ title: '', description: '' });
      setSelectedPin(null);
    });

    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, [user]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    pins.forEach(pin => {
      const marker = L.marker([pin.lat, pin.lng])
        .addTo(map)
        .bindPopup(`<b>${pin.title}</b><br/><small>by ${pin.username} | ❤️ ${pin.like_count}</small><br/>${pin.description || ''}`);
      marker.on('click', () => {
        setSelectedPin(pin);
        fetchComments(pin.id);
        setShowAddForm(false);
      });
      markersRef.current[pin.id] = marker;
    });
  }, [pins]);

  async function handleAddPin(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const res = await fetch('/api/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, title: form.title, description: form.description, lat: newPin.lat, lng: newPin.lng })
    });
    const pin = await res.json();
    setPins(prev => [pin, ...prev]);
    setShowAddForm(false);
    setForm({ title: '', description: '' });
  }

  async function handleLike(pinId) {
    await fetch(`/api/pins/${pinId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    fetchPins();
    if (selectedPin?.id === pinId) {
      setSelectedPin(prev => ({ ...prev, like_count: prev.like_count + (prev.liked ? -1 : 1), liked: !prev.liked }));
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const res = await fetch(`/api/pins/${selectedPin.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, text: commentText })
    });
    const comment = await res.json();
    setComments(prev => [...prev, comment]);
    setCommentText('');
  }

  async function handleDeletePin(pinId) {
    await fetch(`/api/pins/${pinId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    setSelectedPin(null);
    setComments([]);
    fetchPins();
  }

  async function handleDeleteComment(commentId) {
    await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', gap: 0 }}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>📍 Pins ({pins.length})</h3>
        {pins.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Click the map to add a pin!</p>}
        {pins.map(pin => (
          <div key={pin.id} style={{ ...styles.pinItem, borderLeft: selectedPin?.id === pin.id ? '3px solid #e94560' : '3px solid transparent' }}
            onClick={() => { setSelectedPin(pin); fetchComments(pin.id); setShowAddForm(false); }}>
            <b style={{ color: '#fff', fontSize: 13 }}>{pin.title}</b>
            <span style={{ color: '#888', fontSize: 11 }}>by {pin.username} · ❤️ {pin.like_count}</span>
            <span style={{ color: '#666', fontSize: 10 }}>{pin.lat.toFixed(2)}, {pin.lng.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 400 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />

        {showAddForm && (
          <div style={styles.mapModal}>
            <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>📍 New Pin</h3>
            <form onSubmit={handleAddPin}>
              <input style={styles.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" required />
              <textarea style={{ ...styles.input, minHeight: 60, marginTop: 5 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" />
              <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                <button style={styles.btn} type="submit">Save</button>
                <button style={{ ...styles.btn, background: '#555' }} onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {selectedPin && !showAddForm && (
          <div style={styles.mapModal}>
            <h3 style={{ color: '#e94560', margin: '0 0 5px 0' }}>{selectedPin.title}</h3>
            <p style={{ color: '#aaa', fontSize: 12, margin: '0 0 5px 0' }}>by {selectedPin.username}</p>
            {selectedPin.description && <p style={{ color: '#ccc', fontSize: 13, margin: '0 0 8px 0' }}>{selectedPin.description}</p>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 8 }}>
              <button style={{ background: 'none', border: 'none', color: '#e94560', cursor: 'pointer', fontSize: 16 }} onClick={() => handleLike(selectedPin.id)}>
                ❤️ {selectedPin.like_count}
              </button>
              {user.id === selectedPin.user_id && (
                <button style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }} onClick={() => handleDeletePin(selectedPin.id)}>
                  🗑️ Delete
                </button>
              )}
            </div>

            <hr style={{ border: '1px solid #333', margin: '5px 0' }} />

            <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 8 }}>
              {comments.length === 0 && <p style={{ color: '#666', fontSize: 12 }}>No comments yet</p>}
              {comments.map(c => (
                <div key={c.id} style={{ marginBottom: 5, fontSize: 13 }}>
                  <b style={{ color: '#e94560' }}>{c.username}:</b>
                  <span style={{ color: '#ccc' }}> {c.text}</span>
                  {user.id === c.user_id && (
                    <button style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', marginLeft: 5, fontSize: 11 }}
                      onClick={() => handleDeleteComment(c.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: 5 }}>
              <input style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #555', fontSize: 12, background: '#2a2a3e', color: '#fff' }}
                value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Write a comment..." />
              <button style={{ ...styles.btn, padding: '5px 12px', fontSize: 12 }} type="submit">Send</button>
            </form>

            <button style={{ ...styles.btn, padding: '5px 12px', fontSize: 11, background: '#555', marginTop: 8 }} onClick={() => setSelectedPin(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// WAR CARD GAME (from war-app)
// ====================================================================
function WarGame({ user }) {
  const [scores, setScores] = useState([]);
  const [playerName, setPlayerName] = useState(user.display_name || user.username);
  const [lastRound, setLastRound] = useState(null);
  const [roundsWon, setRoundsWon] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);

  useEffect(() => { loadScores(); }, []);

  function loadScores() {
    fetch('/api/scores')
      .then(r => r.json())
      .then(data => setScores(data))
      .catch(() => {});
  }

  function playRound() {
    const playerCard = Math.floor(Math.random() * 13) + 2;
    const computerCard = Math.floor(Math.random() * 13) + 2;
    const result = {
      playerCard: cards[playerCard - 2],
      computerCard: cards[computerCard - 2],
      winner: playerCard > computerCard ? 'player' : playerCard < computerCard ? 'computer' : 'tie'
    };
    setLastRound(result);
    setTotalRounds(t => t + 1);
    if (result.winner === 'player') setRoundsWon(w => w + 1);
  }

  async function saveScore() {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: playerName, score: roundsWon })
    });
    setRoundsWon(0);
    setTotalRounds(0);
    setLastRound(null);
    loadScores();
  }

  return (
    <div style={{ flex: 1, maxWidth: 600, margin: '0 auto', width: '100%', textAlign: 'center' }}>
      <h3 style={{ color: '#fff', marginBottom: 15 }}>⚔️ WAR Card Game</h3>

      <div style={styles.cardArea}>
        <div style={styles.card}>
          <span style={{ fontSize: 14 }}>Your Card</span>
          <span style={{ fontSize: 48 }}>{lastRound ? lastRound.playerCard : '?'}</span>
        </div>
        <div style={styles.vs}>VS</div>
        <div style={styles.card}>
          <span style={{ fontSize: 14 }}>Computer</span>
          <span style={{ fontSize: 48 }}>{lastRound ? lastRound.computerCard : '?'}</span>
        </div>
      </div>

      {lastRound && (
        <div style={{
          ...styles.result,
          color: lastRound.winner === 'player' ? '#2ecc71' : lastRound.winner === 'computer' ? '#e74c3c' : '#f39c12'
        }}>
          {lastRound.winner === 'player' ? '🎉 YOU WIN!' : lastRound.winner === 'computer' ? '😞 Computer Wins' : "🤝 IT'S A TIE!"}
        </div>
      )}

      <div style={styles.stats}>
        Rounds: {totalRounds} | Won: {roundsWon} | Win Rate: {totalRounds > 0 ? Math.round(roundsWon / totalRounds * 100) : 0}%
      </div>

      <button onClick={playRound} style={styles.btn}>⚡ Play a Round</button>

      <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <input style={styles.input} value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Your name" />
        <button onClick={saveScore} style={{ ...styles.btn, background: '#27ae60' }}>💾 Save Score</button>
      </div>

      <h4 style={{ color: '#fff', marginTop: 25 }}>🏆 Leaderboard</h4>
      <table style={styles.table}>
        <thead>
          <tr><th style={styles.th}>Rank</th><th style={styles.th}>Player</th><th style={styles.th}>Score</th></tr>
        </thead>
        <tbody>
          {scores.map((s, i) => (
            <tr key={s.id}>
              <td style={styles.td}>{i + 1}</td>
              <td style={styles.td}>{s.player_name}</td>
              <td style={styles.td}>{s.score}</td>
            </tr>
          ))}
          {scores.length === 0 && (
            <tr><td colSpan={3} style={{ ...styles.td, textAlign: 'center' }}>No scores yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ====================================================================
// PROFILE VIEW
// ====================================================================
function ProfileView({ userId, currentUser }) {
  const [profile, setProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setProfile);
    fetch(`/api/posts?user_id=${userId}`).then(r => r.json()).then(setUserPosts);
  }, [userId]);

  if (!profile) return <div style={{ padding: 20, color: '#888' }}>Loading...</div>;

  return (
    <div style={{ flex: 1, maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <h3 style={{ color: '#fff', marginBottom: 15 }}>👤 My Profile</h3>
      <div style={styles.profileHeader}>
        <h2 style={{ color: '#fff', margin: 0 }}>{profile.display_name || profile.username}</h2>
        <p style={{ color: '#888', margin: '3px 0' }}>@{profile.username} {profile.role === 'admin' && '🛡️ Admin'}</p>
        <div style={{ display: 'flex', gap: 20, marginTop: 10, color: '#aaa', fontSize: 13 }}>
          <span>📝 {profile.post_count} posts</span>
          <span>👥 {profile.follower_count} followers</span>
          <span>{profile.following_count} following</span>
        </div>
      </div>

      <h4 style={{ color: '#fff', margin: '15px 0 10px 0' }}>My Posts</h4>
      {userPosts.length === 0 && <p style={{ color: '#666', textAlign: 'center' }}>No posts yet. Share something!</p>}
      {userPosts.map(post => (
        <div key={post.id} style={styles.post}>
          <p style={{ color: '#ddd', margin: '0 0 5px 0', fontSize: 14 }}>{post.content}</p>
          <span style={{ color: '#888', fontSize: 12 }}>❤️ {post.like_count} · {timeAgo(post.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

// ====================================================================
// ADMIN PANEL (from social-app)
// ====================================================================
function AdminPanel({ admin }) {
  const [subtab, setSubtab] = useState('users');
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [maintMode, setMaintMode] = useState(false);
  const [form, setForm] = useState({ username: '', display_name: '', default_password: '' });
  const [msg, setMsg] = useState('');

  async function fetchAdminUsers() {
    const res = await fetch(`/api/admin/users?admin_id=${admin.id}`);
    setUsers(await res.json());
  }

  async function fetchRequests() {
    const res = await fetch(`/api/admin/reset-requests?admin_id=${admin.id}`);
    setRequests(await res.json());
  }

  async function fetchMaintenance() {
    const res = await fetch('/api/maintenance-status');
    const data = await res.json();
    setMaintMode(data.maintenance_mode === 'on');
  }

  useEffect(() => { fetchAdminUsers(); fetchRequests(); fetchMaintenance(); }, [admin]);

  async function handleRegister(e) {
    e.preventDefault();
    setMsg('');
    if (!form.username) { setMsg('Username required'); return; }
    const res = await fetch('/api/admin/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: admin.id, username: form.username, display_name: form.display_name })
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error); return; }
    setMsg(`✅ User "${data.username}" registered! Default password: "${data.default_password}"`);
    setForm({ username: '', display_name: '', default_password: '' });
    fetchAdminUsers();
  }

  async function handleDeleteUser(userId) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: admin.id })
    });
    fetchAdminUsers();
  }

  async function handleAcceptRequest(requestId) {
    const res = await fetch(`/api/admin/reset-requests/${requestId}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: admin.id })
    });
    const data = await res.json();
    alert(data.message || 'Password reset completed');
    fetchRequests();
  }

  async function toggleMaintenance() {
    const mode = maintMode ? 'off' : 'on';
    const res = await fetch('/api/admin/maintenance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: admin.id, mode })
    });
    const data = await res.json();
    setMaintMode(data.maintenance_mode === 'on');
  }

  return (
    <div style={{ flex: 1, maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <h3 style={{ color: '#f39c12', marginBottom: 15 }}>⚙️ Admin Panel</h3>

      <div style={{ display: 'flex', gap: 5, marginBottom: 15, flexWrap: 'wrap' }}>
        <button style={subtab === 'users' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setSubtab('users')}>👥 Users</button>
        <button style={subtab === 'register' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setSubtab('register')}>➕ Register</button>
        <button style={subtab === 'requests' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setSubtab('requests')}>🔑 Reset Requests ({requests.filter(r => r.status === 'pending').length})</button>
        <button style={subtab === 'settings' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setSubtab('settings')}>⚡ Settings</button>
      </div>

      {subtab === 'users' && (
        <div>
          {users.map(u => (
            <div key={u.id} style={styles.userCard}>
              <div>
                <span style={{ color: u.role === 'admin' ? '#f39c12' : '#e94560', fontWeight: 'bold', fontSize: 14 }}>{u.display_name || u.username}</span>
                <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>@{u.username}</span>
                <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                  {u.role === 'admin' && '🛡️ Admin · '}
                  📝 {u.post_count} posts · {u.must_change_password ? '🔒 Must reset' : '✅ Active'}
                </div>
              </div>
              {u.id !== admin.id && u.role !== 'admin' && (
                <button style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                  onClick={() => { if (confirm(`Delete ${u.username}?`)) handleDeleteUser(u.id); }}>Delete</button>
              )}
            </div>
          ))}
        </div>
      )}

      {subtab === 'register' && (
        <div style={styles.adminCard}>
          <h4 style={{ color: '#fff', margin: '0 0 10px 0' }}>Register New User</h4>
          {msg && <p style={{ color: '#2ecc71', fontSize: 13, marginBottom: 8 }}>{msg}</p>}
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input style={styles.input} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Username" required />
            <input style={styles.input} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Display name (optional)" />
            <p style={{ color: '#888', fontSize: 12, margin: 0 }}>A random 6-character password will be auto-generated.</p>
            <button style={styles.btn} type="submit">Register User</button>
          </form>
        </div>
      )}

      {subtab === 'requests' && (
        <div>
          {requests.length === 0 && <p style={{ color: '#666' }}>No reset requests</p>}
          {requests.map(r => (
            <div key={r.id} style={styles.userCard}>
              <div>
                <span style={{ color: '#e94560', fontWeight: 'bold' }}>{r.display_name || r.username}</span>
                <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>@{r.username}</span>
                <div style={{ color: r.status === 'pending' ? '#f39c12' : r.status === 'accepted' ? '#2ecc71' : '#e74c3c', fontSize: 11, marginTop: 2 }}>
                  {r.status === 'pending' && '⏳ Pending'}
                  {r.status === 'accepted' && '✅ Accepted'}
                  {r.status === 'denied' && '❌ Denied'}
                </div>
              </div>
              {r.status === 'pending' && (
                <button style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                  onClick={() => handleAcceptRequest(r.id)}>✅ Accept</button>
              )}
            </div>
          ))}
        </div>
      )}

      {subtab === 'settings' && (
        <div style={styles.adminCard}>
          <h4 style={{ color: '#fff', margin: '0 0 10px 0' }}>App Settings</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#ddd', fontSize: 14 }}>🔧 Maintenance Mode</span>
              <p style={{ color: '#888', fontSize: 12, margin: '3px 0 0 0' }}>
                {maintMode ? 'Users cannot access the app. Only admin can login.' : 'App is open to all users.'}
              </p>
            </div>
            <button
              style={maintMode ? { ...styles.followBtn, background: '#e74c3c' } : { ...styles.followBtn, background: '#2ecc71' }}
              onClick={toggleMaintenance}
            >
              {maintMode ? '🔴 Turn Off' : '🟢 Turn On'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ====================================================================
// STYLES
// ====================================================================
const styles = {
  loginWrap: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    fontFamily: 'Arial, sans-serif'
  },
  loginBox: { background: '#1e1e32', padding: 40, borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 30px rgba(0,0,0,0.5)', minWidth: 300 },
  container: { fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a2e' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#16213e', borderBottom: '1px solid #333' },
  tabs: { display: 'flex', background: '#1e1e32', borderBottom: '1px solid #333', overflowX: 'auto' },
  tab: { flex: 1, padding: '10px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap' },
  content: { flex: 1, overflow: 'auto', padding: 16, display: 'flex' },
  composer: { background: '#1e1e32', borderRadius: 10, padding: 12, marginBottom: 15, border: '1px solid #333' },
  textarea: {
    width: '100%', minHeight: 60, padding: 8, borderRadius: 6, border: '1px solid #444',
    background: '#2a2a3e', color: '#fff', fontSize: 14, resize: 'none', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8
  },
  post: { background: '#1e1e32', borderRadius: 10, padding: 14, marginBottom: 10, border: '1px solid #333' },
  userCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#1e1e32', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #333'
  },
  profileHeader: { background: '#1e1e32', borderRadius: 10, padding: 16, border: '1px solid #333' },
  adminCard: { background: '#1e1e32', borderRadius: 10, padding: 16, border: '1px solid #f39c1255' },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 14, lineHeight: 1.4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' },
  tabBtn: { background: '#2a2a3e', color: '#aaa', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  activeTabBtn: { background: '#f39c12', color: '#000', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 'bold' },
  input: { padding: '10px 14px', borderRadius: 8, border: '1px solid #555', fontSize: 14, background: '#2a2a3e', color: '#fff', outline: 'none' },
  btn: { background: '#e94560', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 'bold' },
  smallBtn: { background: '#333', color: '#aaa', border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  followBtn: { background: '#e94560', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
  deleteBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
  cardArea: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 15 },
  card: { background: '#fff', borderRadius: 10, padding: '15px 25px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', minWidth: 100 },
  vs: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  result: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  stats: { color: '#ccc', fontSize: 14, marginBottom: 15 },
  table: { width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' },
  th: { padding: '8px 12px', borderBottom: '2px solid #e94560', textAlign: 'left' },
  td: { padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  sidebar: { width: 260, background: '#1e1e32', padding: 16, overflowY: 'auto', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 5 },
  pinItem: { padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: '#2a2a3e', display: 'flex', flexDirection: 'column', gap: 2 },
  mapModal: { position: 'absolute', top: 10, right: 10, width: 280, background: '#1e1e32', borderRadius: 10, padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.6)', zIndex: 1000 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modalContent: { background: '#1e1e32', borderRadius: 12, padding: 24, maxWidth: 450, width: '90%', maxHeight: '80vh', overflow: 'auto', position: 'relative', boxShadow: '0 4px 30px rgba(0,0,0,0.6)' }
};