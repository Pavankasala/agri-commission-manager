import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from './api/config';

// Agri Commission Manager App Routing
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import BuyersDetails from './pages/BuyersDetails';
import Expenditures from './pages/Expenditures';
import CashCollection from './pages/CashCollection';
import BalanceSheet from './pages/BalanceSheet';
import SMS from './pages/SMS';
import BeatPaper from './pages/BeatPaper';
import LocalSale from './pages/LocalSale';
import KisanBalance from './pages/KisanBalance';
import NotPaidBills from './pages/NotPaidBills';
import PaidBills from './pages/PaidBills';
import Shops from './pages/Shops';
import Bags from './pages/Bags';
import Settings from './pages/Settings';
import Kisans from './pages/Kisans';
import UserApprovals from './pages/UserApprovals';

import Bills from './pages/Bills';
import Advance from './pages/Advance';
import SoldData from './pages/SoldData';
import BuyerBalance from './pages/BuyerBalance';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      const saved = localStorage.getItem('user');
      if (!token || !token.trim() || !saved) {
        return null;
      }
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  });

  const isAuthenticated = Boolean(user && localStorage.getItem('token'));
  const isAdmin = Boolean(
    user && (user.is_admin || user.role === 'ADMIN' || user.user_type === 'ADMIN' || user.user_id === 1 || user.id === 1)
  );
  const isAccessAllowed = Boolean(
    isAuthenticated && (isAdmin || (user?.is_approved !== false && user?.status !== 'PENDING' && user?.status !== 'REJECTED'))
  );

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleUpdateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const handleCheckStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(API_ENDPOINTS.AUTH_ME, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success && res.data.user) {
        if (res.data.user.is_approved) {
          handleUpdateUser(res.data.user);
          window.location.reload();
        } else {
          alert('Your account is still awaiting approval from the administrator.');
        }
      }
    } catch (e) {
      alert('Your account is still awaiting approval from the administrator.');
    }
  };

  // If user is authenticated but not approved, display pending screen
  if (isAuthenticated && !isAccessAllowed) {
    const isRejected = user?.status === 'REJECTED';
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: isRejected ? '1px solid #fecaca' : '1px solid #fed7aa'
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>
            {isRejected ? '🚫' : '⏳'}
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px' }}>
            {isRejected ? 'Access Request Declined' : 'Account Pending Approval'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px' }}>
            {isRejected
              ? 'Your request for access has been declined by the system administrator. Please contact your company administrator if you believe this was an error.'
              : 'Your account has been registered, but an administrator must approve your access before you can enter the application.'}
          </p>

          <div style={{
            backgroundColor: isRejected ? '#fef2f2' : '#fffbeb',
            color: isRejected ? '#991b1b' : '#9a3412',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            👤 <strong>Account:</strong> {user?.name || user?.owner_name || 'Operator'} ({user?.email})<br />
            🛡️ <strong>Status:</strong> {isRejected ? 'Declined' : 'Awaiting Administrator Review'}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {!isRejected && (
              <button
                onClick={handleCheckStatus}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                🔄 Check Approval Status
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: 'white',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/signup" element={<Signup onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/home" element={isAccessAllowed ? <Home user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/" />} />
        
        {/* User Access Approvals (Admin Only) */}
        <Route path="/user-approvals" element={isAccessAllowed && isAdmin ? <UserApprovals user={user} onLogout={handleLogout} /> : <Navigate to="/home" />} />
        <Route path="/approvals" element={<Navigate to="/user-approvals" />} />
        <Route path="/access-requests" element={<Navigate to="/user-approvals" />} />

        {/* Buyers Details */}
        <Route path="/buyers-details" element={isAccessAllowed ? <BuyersDetails user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/buyersDetails" element={isAccessAllowed ? <BuyersDetails user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/sell" element={isAccessAllowed ? <SoldData user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/sold-data" element={isAccessAllowed ? <SoldData user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Expenditures */}
        <Route path="/expenditures" element={isAccessAllowed ? <Expenditures user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Cash Collection */}
        <Route path="/cash-collection" element={isAccessAllowed ? <CashCollection user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/cashCollection" element={isAccessAllowed ? <CashCollection user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/cash" element={isAccessAllowed ? <CashCollection user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Balance Sheet */}
        <Route path="/balancesheet" element={isAccessAllowed ? <BalanceSheet user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/balanceSheet" element={isAccessAllowed ? <BalanceSheet user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* SMS */}
        <Route path="/sms" element={isAccessAllowed ? <SMS user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Beat Paper */}
        <Route path="/beatpaper" element={isAccessAllowed ? <BeatPaper user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/beatPaper" element={isAccessAllowed ? <BeatPaper user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Local Sale */}
        <Route path="/localSale" element={isAccessAllowed ? <LocalSale user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/localsale" element={isAccessAllowed ? <LocalSale user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Kisan Balance & Buyer Balance */}
        <Route path="/kisanbalance" element={isAccessAllowed ? <KisanBalance user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/kisanBalance" element={isAccessAllowed ? <KisanBalance user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/buyerbalance" element={isAccessAllowed ? <BuyerBalance user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/buyers-balance" element={isAccessAllowed ? <BuyerBalance user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/buyerBalance" element={isAccessAllowed ? <BuyerBalance user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Not Paid / Paid Bills */}
        <Route path="/notpaidbills" element={isAccessAllowed ? <NotPaidBills user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/notPaidBills" element={isAccessAllowed ? <NotPaidBills user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/paidBills" element={isAccessAllowed ? <PaidBills user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/paidbills" element={isAccessAllowed ? <PaidBills user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Shops & Miscellaneous */}
        <Route path="/shops" element={isAccessAllowed ? <Shops user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/bags" element={isAccessAllowed ? <Bags user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/settings" element={isAccessAllowed ? <Settings user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/" />} />
        <Route path="/kisans" element={isAccessAllowed ? <Kisans user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />

        {/* Bills & Advance Dedicated Routes */}
        <Route path="/bills" element={isAccessAllowed ? <Bills user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/advance" element={isAccessAllowed ? <Advance user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

