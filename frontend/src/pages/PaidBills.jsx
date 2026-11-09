import React, { useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function PaidBills({ user, onLogout }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bills, setBills] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleGetPaidBills = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.get(`${API_BASE_URL}/api/home-bills?date=${date}`);
      if (res.data && res.data.success) {
        const apiBills = (res.data.bills || []).filter(b => b.paid === 'YES');
        setBills(apiBills);
        setSearched(true);
        return;
      }
    } catch (e) { }
    setBills([]);
    setSearched(true);
  };


  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Form Card */}
        <div style={{ maxWidth: '420px', margin: '0 auto 20px auto', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
            Paid Bills
          </div>

          <form onSubmit={handleGetPaidBills} style={{ padding: '16px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '80px', fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
              />
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Get Paid Bills
            </button>
          </form>
        </div>

        {/* Paid Bills Table Card */}
        {searched && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
            <h2 align="center" style={{ color: '#15803d', margin: '0 0 16px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>
              - Paid Bills ({date}) -
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>S.No.</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Kisan Name</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Bags</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Price</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Net Total (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr><td colSpan="7" align="center" style={{ padding: '16px', color: '#dc2626', fontWeight: 'bold' }}>No Paid Bills Found for {date}</td></tr>
                  ) : (
                    bills.map((b, idx) => {
                      const total = b.no_of_bags * b.price;
                      return (
                        <tr key={b.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '8px' }}>{idx + 1}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{b.name}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{b.no_of_bags}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>₹{b.price}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>₹{total.toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>₹{total.toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{b.date}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
