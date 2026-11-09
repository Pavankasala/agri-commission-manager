import React, { useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function NotPaidBills({ user, onLogout }) {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [bills, setBills] = useState([]);
  const [searched, setSearched] = useState(false);

  const years = [];
  for (let y = 2017; y <= 2060; y++) {
    years.push(y);
  }

  const handleGetBills = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.get(`${API_BASE_URL}/api/home-bills`);
      if (res.data && res.data.success) {
        const apiBills = (res.data.bills || []).filter(b => b.paid !== 'YES');
        setBills(apiBills);
        setSearched(true);
        return;
      }
    } catch (e) { }
    setBills([]);
    setSearched(true);
  };


  const netTotalSum = bills.reduce((acc, b) => acc + (b.no_of_bags * b.price), 0);

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Form Card */}
        <div style={{ maxWidth: '420px', margin: '0 auto 20px auto', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
            Not Paid Bills
          </div>

          <form onSubmit={handleGetBills} style={{ padding: '16px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Select Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Get Unpaid Bills
            </button>
          </form>
        </div>

        {/* Unpaid Bills Table Card */}
        {searched && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ color: '#15803d', margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
                - Unpaid Bills ({selectedYear}) -
              </h2>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🖨️ Print Unpaid Bills
              </button>
            </div>

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
                    <tr><td colSpan="7" align="center" style={{ padding: '16px', color: '#dc2626', fontWeight: 'bold' }}>No Unpaid Bills Found for Year {selectedYear}</td></tr>
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
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>₹{total.toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{b.date}</td>
                        </tr>
                      );
                    })
                  )}
                  {bills.length > 0 && (
                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      <td colSpan="5" align="right" style={{ padding: '10px' }}>Total Net Balance Unpaid:</td>
                      <td align="right" colSpan="2" style={{ padding: '10px', color: '#dc2626', fontSize: '1.1rem' }}>
                        ₹{netTotalSum.toFixed(2)}
                      </td>
                    </tr>
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
