import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_ENDPOINTS } from '../api/config';

export default function UserApprovals({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'

  const currentUserId = user?.user_id || user?.id || 1;

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(API_ENDPOINTS.ADMIN_USERS, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        const fetched = res.data.users || [];
        setUsers(fetched);
        // If there are pending users and tab is not manually switched, default to PENDING
        const pendingCount = fetched.filter(u => u.status === 'PENDING' || !u.is_approved).length;
        if (pendingCount > 0 && activeTab === 'ALL') {
          setActiveTab('PENDING');
        }
      } else {
        setError(res.data?.message || 'Failed to fetch users list');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users list from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (targetId) => {
    setActionLoadingId(targetId);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(API_ENDPOINTS.ADMIN_APPROVE_USER(targetId), {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'User access approved successfully!');
        setUsers(prev => prev.map(u => (u.user_id === targetId ? { ...u, status: 'APPROVED', is_approved: true } : u)));
      } else {
        setError(res.data?.message || 'Failed to approve user');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve user');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (targetId) => {
    if (!window.confirm('Are you sure you want to decline access for this user?')) return;
    setActionLoadingId(targetId);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(API_ENDPOINTS.ADMIN_REJECT_USER(targetId), {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'User access rejected.');
        setUsers(prev => prev.map(u => (u.user_id === targetId ? { ...u, status: 'REJECTED', is_approved: false } : u)));
      } else {
        setError(res.data?.message || 'Failed to reject user');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject user');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (targetId) => {
    if (!window.confirm('Are you sure you want to revoke access? This user will be blocked from using the application until re-approved.')) return;
    setActionLoadingId(targetId);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(API_ENDPOINTS.ADMIN_REVOKE_USER(targetId), {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Access revoked. User is now Pending.');
        setUsers(prev => prev.map(u => (u.user_id === targetId ? { ...u, status: 'PENDING', is_approved: false } : u)));
      } else {
        setError(res.data?.message || 'Failed to revoke access');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke access');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleRole = async (targetId, currentRole) => {
    const isTargetAdmin = currentRole === 'ADMIN';
    const msg = isTargetAdmin
      ? 'Remove Administrator privileges from this user? They will become a standard operator.'
      : 'Grant Administrator privileges to this user? They will be able to approve access and manage users.';
    if (!window.confirm(msg)) return;

    setActionLoadingId(targetId);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(API_ENDPOINTS.ADMIN_TOGGLE_ROLE(targetId), {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Role updated successfully.');
        setUsers(prev => prev.map(u => (u.user_id === targetId ? {
          ...u,
          role: isTargetAdmin ? 'USER' : 'ADMIN',
          is_admin: !isTargetAdmin,
          status: 'APPROVED',
          is_approved: true
        } : u)));
      } else {
        setError(res.data?.message || 'Failed to update role');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (targetId, targetName) => {
    if (!window.confirm(`Are you sure you want to completely delete account "${targetName}"? This action cannot be undone.`)) return;
    setActionLoadingId(targetId);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(API_ENDPOINTS.ADMIN_DELETE_USER(targetId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'User deleted successfully.');
        setUsers(prev => prev.filter(u => u.user_id !== targetId));
      } else {
        setError(res.data?.message || 'Failed to delete user');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Stats calculation
  const totalCount = users.length;
  const pendingCount = users.filter(u => u.status === 'PENDING' || (!u.is_approved && u.status !== 'REJECTED')).length;
  const approvedCount = users.filter(u => u.status === 'APPROVED' || (u.is_approved && u.status !== 'REJECTED')).length;
  const rejectedCount = users.filter(u => u.status === 'REJECTED').length;

  // Filtered users
  const filteredUsers = users.filter(u => {
    // Search match
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (u.name || '').toLowerCase().includes(q);
    const emailMatch = (u.email || '').toLowerCase().includes(q);
    const userMatch = (u.user_name || '').toLowerCase().includes(q);
    const phoneMatch = (u.mobile || u.phone || '').toLowerCase().includes(q);
    const matchesSearch = !q || nameMatch || emailMatch || userMatch || phoneMatch;

    if (!matchesSearch) return false;

    if (activeTab === 'PENDING') return u.status === 'PENDING' || (!u.is_approved && u.status !== 'REJECTED');
    if (activeTab === 'APPROVED') return u.status === 'APPROVED' || (u.is_approved && u.status !== 'REJECTED');
    if (activeTab === 'REJECTED') return u.status === 'REJECTED';
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      <Header user={user} onLogout={onLogout} />

      <style>{`
        .approvals-container {
          max-width: 1200px;
          margin: 24px auto;
          padding: 0 16px;
        }

        .page-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .page-title h1 {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 6px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .page-title p {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 18px 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .stat-card.active-stat {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.2);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .stat-info h3 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
        }

        .stat-info span {
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
        }

        .controls-bar {
          background: white;
          padding: 16px 20px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }

        .tabs-group {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tab-btn {
          background: transparent;
          border: 1px solid #cbd5e1;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }

        .tab-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .tab-btn.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .search-box {
          position: relative;
          min-width: 260px;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        }

        .search-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
        }

        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
          color: #94a3b8;
        }

        .users-table-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        .custom-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .custom-table th {
          background: #f8fafc;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e2e8f0;
        }

        .custom-table td {
          padding: 14px 16px;
          font-size: 14px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .custom-table tr:hover {
          background: #f8fafc;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e2e8f0;
          color: #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 16px;
          flex-shrink: 0;
        }

        .user-identity {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-names .full-name {
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 2px;
        }

        .user-names .user-handle {
          font-size: 12px;
          color: #64748b;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-badge.approved {
          background: #dcfce7;
          color: #15803d;
        }

        .status-badge.pending {
          background: #ffedd5;
          color: #c2410c;
        }

        .status-badge.rejected {
          background: #fee2e2;
          color: #b91c1c;
        }

        .role-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }

        .role-badge.admin {
          background: #e0e7ff;
          color: #4338ca;
        }

        .role-badge.user {
          background: #f1f5f9;
          color: #475569;
        }

        .action-btns {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-approve {
          background: #16a34a;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: background 0.15s;
        }

        .btn-approve:hover {
          background: #15803d;
        }

        .btn-reject {
          background: white;
          color: #dc2626;
          border: 1px solid #fca5a5;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-reject:hover {
          background: #fef2f2;
          border-color: #dc2626;
        }

        .btn-revoke {
          background: white;
          color: #d97706;
          border: 1px solid #fcd34d;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-revoke:hover {
          background: #fffbeb;
          border-color: #d97706;
        }

        .btn-toggle-role {
          background: white;
          color: #4f46e5;
          border: 1px solid #c7d2fe;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-toggle-role:hover {
          background: #eef2ff;
        }

        .btn-delete {
          background: white;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }

        .btn-delete:hover {
          color: #ef4444;
          border-color: #fca5a5;
        }

        .alert-banner {
          padding: 12px 18px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .alert-banner.success {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .alert-banner.error {
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        @media (max-width: 840px) {
          .custom-table th:nth-child(4),
          .custom-table td:nth-child(4) {
            display: none;
          }
        }
      `}</style>

      <div className="approvals-container">
        {/* Page Title & Refresh */}
        <div className="page-header">
          <div className="page-title">
            <h1>🔐 User Access Control & Approvals</h1>
            <p>
              Only approved users can access application bills, records, and reports.
              You have full control to approve, decline, or revoke access permissions.
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              color: '#334155'
            }}
          >
            🔄 {loading ? 'Refreshing...' : 'Refresh Users'}
          </button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="alert-banner success">
            <span>✅ {successMsg}</span>
            <button
              onClick={() => setSuccessMsg('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="alert-banner error">
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="stats-grid">
          <div
            className={`stat-card ${activeTab === 'PENDING' ? 'active-stat' : ''}`}
            onClick={() => setActiveTab('PENDING')}
          >
            <div className="stat-icon" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
              ⏳
            </div>
            <div className="stat-info">
              <h3>{pendingCount}</h3>
              <span>Pending Approvals</span>
            </div>
          </div>

          <div
            className={`stat-card ${activeTab === 'APPROVED' ? 'active-stat' : ''}`}
            onClick={() => setActiveTab('APPROVED')}
          >
            <div className="stat-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
              ✅
            </div>
            <div className="stat-info">
              <h3>{approvedCount}</h3>
              <span>Approved Active Users</span>
            </div>
          </div>

          <div
            className={`stat-card ${activeTab === 'REJECTED' ? 'active-stat' : ''}`}
            onClick={() => setActiveTab('REJECTED')}
          >
            <div className="stat-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
              🚫
            </div>
            <div className="stat-info">
              <h3>{rejectedCount}</h3>
              <span>Declined Requests</span>
            </div>
          </div>

          <div
            className={`stat-card ${activeTab === 'ALL' ? 'active-stat' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            <div className="stat-icon" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
              👥
            </div>
            <div className="stat-info">
              <h3>{totalCount}</h3>
              <span>Total Registered Users</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="controls-bar">
          <div className="tabs-group">
            <button
              className={`tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
              onClick={() => setActiveTab('PENDING')}
            >
              ⏳ Pending ({pendingCount})
            </button>
            <button
              className={`tab-btn ${activeTab === 'APPROVED' ? 'active' : ''}`}
              onClick={() => setActiveTab('APPROVED')}
            >
              ✅ Approved ({approvedCount})
            </button>
            <button
              className={`tab-btn ${activeTab === 'REJECTED' ? 'active' : ''}`}
              onClick={() => setActiveTab('REJECTED')}
            >
              🚫 Declined ({rejectedCount})
            </button>
            <button
              className={`tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              👥 All Accounts ({totalCount})
            </button>
          </div>

          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="users-table-card">
          {loading && users.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '30px', marginBottom: '10px' }}>⏳</div>
              <p>Loading user access records...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
              <p style={{ fontWeight: '700', fontSize: '16px', color: '#334155', margin: '0 0 6px' }}>
                No users found
              </p>
              <p style={{ margin: 0, fontSize: '13px' }}>
                {searchQuery
                  ? `No accounts match "${searchQuery}".`
                  : activeTab === 'PENDING'
                  ? 'Great! There are no users waiting for access approval.'
                  : 'No users found in this category.'}
              </p>
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.user_id === currentUserId;
                  const isApproved = u.status === 'APPROVED' || (u.is_approved && u.status !== 'REJECTED');
                  const isPending = u.status === 'PENDING' || (!u.is_approved && u.status !== 'REJECTED');
                  const isRejected = u.status === 'REJECTED';
                  const isTargetAdmin = u.role === 'ADMIN' || u.user_type === 'ADMIN' || u.is_admin;
                  const isActionLoading = actionLoadingId === u.user_id;

                  const initials = (u.name || u.user_name || 'U')
                    .split(' ')
                    .map(part => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={u.user_id}>
                      {/* Identity */}
                      <td>
                        <div className="user-identity">
                          <div
                            className="user-avatar"
                            style={{
                              backgroundColor: isApproved ? '#dcfce7' : isPending ? '#ffedd5' : '#fee2e2',
                              color: isApproved ? '#15803d' : isPending ? '#c2410c' : '#b91c1c'
                            }}
                          >
                            {initials}
                          </div>
                          <div className="user-names">
                            <div className="full-name">
                              {u.name || 'Unnamed Operator'}
                              {isSelf && (
                                <span style={{ marginLeft: '6px', fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="user-handle">
                              @{u.user_name || 'user'} • {u.auth_provider === 'GOOGLE' ? '🌐 Google' : '🔑 Email'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                          {u.email}
                        </div>
                        {u.mobile && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            📞 {u.mobile}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td>
                        <span className={`role-badge ${isTargetAdmin ? 'admin' : 'user'}`}>
                          {isTargetAdmin ? '👑 Admin' : '👨‍🌾 Operator'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {u.created_at ? u.created_at.split(' ')[0] : 'Existing'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        {isApproved && (
                          <span className="status-badge approved">
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                            Approved
                          </span>
                        )}
                        {isPending && (
                          <span className="status-badge pending">
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ea580c' }}></span>
                            Pending Approval
                          </span>
                        )}
                        {isRejected && (
                          <span className="status-badge rejected">
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626' }}></span>
                            Declined
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                          {isActionLoading ? (
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', padding: '6px' }}>
                              Updating...
                            </span>
                          ) : (
                            <>
                              {isPending && (
                                <>
                                  <button
                                    className="btn-approve"
                                    onClick={() => handleApprove(u.user_id)}
                                    title="Grant this user full access to the application"
                                  >
                                    ✅ Approve Access
                                  </button>
                                  <button
                                    className="btn-reject"
                                    onClick={() => handleReject(u.user_id)}
                                    title="Decline this access request"
                                  >
                                    Decline
                                  </button>
                                </>
                              )}

                              {isApproved && !isSelf && (
                                <>
                                  <button
                                    className="btn-revoke"
                                    onClick={() => handleRevoke(u.user_id)}
                                    title="Revoke access immediately (user will be blocked)"
                                  >
                                    🔒 Revoke Access
                                  </button>
                                  <button
                                    className="btn-toggle-role"
                                    onClick={() => handleToggleRole(u.user_id, u.role)}
                                    title={isTargetAdmin ? "Demote to standard operator" : "Promote to administrator"}
                                  >
                                    {isTargetAdmin ? 'Demote' : '👑 Make Admin'}
                                  </button>
                                </>
                              )}

                              {isRejected && (
                                <button
                                  className="btn-approve"
                                  onClick={() => handleApprove(u.user_id)}
                                  title="Approve access for this user"
                                >
                                  🔄 Re-Approve
                                </button>
                              )}

                              {!isSelf && (
                                <button
                                  className="btn-delete"
                                  onClick={() => handleDelete(u.user_id, u.name || u.email)}
                                  title="Permanently delete user record"
                                >
                                  🗑️
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

