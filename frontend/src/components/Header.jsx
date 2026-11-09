import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../api/config';

export default function Header({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const isAdmin = Boolean(
    user?.is_admin ||
    user?.role === 'ADMIN' ||
    user?.user_type === 'ADMIN' ||
    user?.user_id === 1 ||
    user?.id === 1
  );

  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(API_ENDPOINTS.ADMIN_PENDING_COUNT, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted && res.data?.success) {
          setPendingCount(res.data.pending_count || 0);
        }
      } catch (e) {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

  const handleLogout = (e) => {
    e.preventDefault();
    if (onLogout) onLogout();
    navigate('/');
  };

  const businessName = user?.business_name || user?.company_full_name || user?.company_name || 'Agri Commission Manager';
  const ownerName = user?.owner_name || user?.name || 'Operator';

  const navLinks = [
    { path: '/home', label: 'Home' },
    { path: '/buyers-details', label: 'Buyer Bills' },
    { path: '/expenditures', label: 'Expenditures' },
    { path: '/cash-collection', label: 'Cash' },
    { path: '/bills', label: 'Bills' },
    { path: '/sms', label: 'SMS' },
    { path: '/advance', label: 'Advance' },
    { path: '/balancesheet', label: 'Balance Sheet' },
    { path: '/sell', label: 'Sold Data' },
    { path: '/beatpaper', label: 'Beat Paper' },
    { path: '/kisanbalance', label: 'Kisan Balance' },
    { path: '/buyerbalance', label: 'Buyer Balance' },
    ...(user?.user_type === 'ADM' ? [{ path: '/sales', label: 'Delhi' }] : []),
    { path: '/notpaidbills', label: 'Not Paid Bills' },
    { path: '/paidBills', label: 'Paid Bills' },
    { path: '/shops', label: 'Shops' },
    { path: '/localSale', label: 'Local Sale' },
  ];

  const quickLinks = [
    ...(isAdmin ? [{ path: '/user-approvals', label: pendingCount > 0 ? `🔐 Approvals (${pendingCount})` : '🔐 Approvals' }] : []),
    { path: '/bags', label: '📦 Bags' },
    { path: '/settings', label: '⚙️ Settings' },
    { path: '/kisans', label: '👨‍🌾 Kisans' },
  ];

  return (
    <>
      <style>{`
        .agri-header {
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%);
          color: white;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        }

        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          gap: 12px;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: white;
          min-width: 0;
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .brand-text h1 {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          color: white;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .brand-text span {
          font-size: 11px;
          opacity: 0.8;
          font-weight: 400;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .header-user-badge {
          display: none;
          background: rgba(255,255,255,0.15);
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .header-logout-btn {
          background: rgba(255,255,255,0.15);
          color: white;
          border: 1px solid rgba(255,255,255,0.25);
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .header-logout-btn:hover {
          background: rgba(255,255,255,0.25);
          transform: none;
        }

        .hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          cursor: pointer;
          padding: 6px;
          border: none;
          background: transparent;
        }

        .hamburger span {
          display: block;
          width: 22px;
          height: 2.5px;
          background: white;
          border-radius: 2px;
          transition: all 0.3s;
        }

        .hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
        .hamburger.open span:nth-child(2) { opacity: 0; }
        .hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }

        .header-nav {
          background: rgba(0,0,0,0.08);
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .nav-scroll {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 3px;
          padding: 6px 12px;
          list-style: none;
          margin: 0;
        }

        .nav-link {
          display: inline-block;
          color: rgba(255,255,255,0.88);
          text-decoration: none;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .nav-link:hover {
          background: rgba(255,255,255,0.15);
          color: #fff;
        }

        .nav-link.active {
          background: rgba(255,255,255,0.22);
          color: #fff;
          font-weight: 600;
        }

        .quick-links-bar {
          display: flex;
          justify-content: center;
          gap: 14px;
          padding: 4px 12px 6px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .quick-link {
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.15s;
        }

        .quick-link:hover {
          color: #fff;
        }

        /* ===== RESPONSIVE ===== */
        @media (min-width: 769px) {
          .header-user-badge { display: block; }
        }

        @media (max-width: 768px) {
          .header-top {
            padding: 8px 14px;
          }

          .brand-text h1 {
            font-size: 15px;
          }

          .brand-text span {
            display: none;
          }

          .hamburger {
            display: flex;
          }

          .header-nav {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.35s ease;
          }

          .header-nav.open {
            max-height: 600px;
          }

          .nav-scroll {
            flex-direction: column;
            gap: 2px;
            padding: 8px 14px;
          }

          .nav-link {
            padding: 10px 14px;
            font-size: 14px;
            border-radius: 8px;
          }

          .nav-link:hover, .nav-link.active {
            background: rgba(255,255,255,0.12);
          }

          .quick-links-bar {
            flex-direction: column;
            gap: 2px;
            padding: 0 14px 10px;
          }

          .quick-link {
            padding: 8px 14px;
            background: rgba(255,255,255,0.06);
            border-radius: 8px;
            font-size: 13px;
            display: block;
          }
        }

        @media (max-width: 480px) {
          .brand-icon {
            width: 30px;
            height: 30px;
            font-size: 16px;
          }

          .brand-text h1 {
            font-size: 14px;
          }

          .header-logout-btn {
            font-size: 12px;
            padding: 5px 10px;
          }
        }
      `}</style>

      <header className="agri-header">
        <div className="header-top">
          <Link to="/home" className="header-brand">
            <div className="brand-icon">🌱</div>
            <div className="brand-text">
              <h1>{businessName}</h1>
              <span>Commission Agent</span>
            </div>
          </Link>

          <div className="header-actions">
            {isAdmin && (
              <Link
                to="/user-approvals"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: pendingCount > 0 ? '#ea580c' : 'rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  border: pendingCount > 0 ? '1px solid #fdba74' : '1px solid rgba(255,255,255,0.3)',
                  boxShadow: pendingCount > 0 ? '0 0 8px rgba(234, 88, 12, 0.6)' : 'none',
                  transition: 'all 0.2s ease',
                }}
                title={pendingCount > 0 ? `${pendingCount} users waiting for your approval` : "Manage User Approvals"}
              >
                <span>🔐 Approvals</span>
                {pendingCount > 0 && (
                  <span style={{
                    background: 'white',
                    color: '#ea580c',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '11px',
                    fontWeight: '800'
                  }}>
                    {pendingCount}
                  </span>
                )}
              </Link>
            )}
            <div className="header-user-badge">
              👤 {ownerName}
            </div>
            <button className="header-logout-btn" onClick={handleLogout}>
              Logout
            </button>
            <button
              className={`hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>

        <nav className={`header-nav ${menuOpen ? 'open' : ''}`}>
          <ul className="nav-scroll">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="quick-links-bar">
            {quickLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="quick-link"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
    </>
  );
}
