import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function BalanceSheet({ user, onLogout }) {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [kisanData, setKisanData] = useState({ rows: [], summary: { total_amount: 0, net_amount: 0, cash_paid: 0, pending_balance: 0 } });
  const [buyerData, setBuyerData] = useState({ rows: [], summary: { total_amount: 0, cash_paid: 0, pending_balance: 0 } });
  const [activeTab, setActiveTab] = useState('ALL');
  const [searched, setSearched] = useState(false);

  const years = [];
  for (let y = 2017; y <= 2060; y++) {
    years.push(y);
  }

  const fetchBalanceSheet = async (e) => {
    if (e) e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [kisanRes, buyerRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/kisan-balance?year=${selectedYear}`, { headers }).catch(() => null),
        axios.get(`${API_BASE_URL}/api/buyer-balance?year=${selectedYear}`, { headers }).catch(() => null)
      ]);

      let kRows = [];
      let kSum = { total_amount: 0, net_amount: 0, cash_paid: 0, pending_balance: 0 };
      if (kisanRes?.data?.success) {
        kRows = kisanRes.data.records || [];
        kSum = kisanRes.data.summary || {
          total_amount: kRows.reduce((a, r) => a + (r.total_amount || 0), 0),
          net_amount: kRows.reduce((a, r) => a + (r.net_amount || r.total_amount || 0), 0),
          cash_paid: kRows.reduce((a, r) => a + (r.advance || 0), 0),
          pending_balance: kRows.reduce((a, r) => a + (r.pending_balance || 0), 0)
        };
      }

      let bRows = [];
      let bSum = { total_amount: 0, cash_paid: 0, pending_balance: 0 };
      if (buyerRes?.data?.success) {
        bRows = buyerRes.data.records || [];
        bSum = buyerRes.data.summary || {
          total_amount: bRows.reduce((a, r) => a + (r.total_amount || 0), 0),
          cash_paid: bRows.reduce((a, r) => a + (r.cash_paid || r.advance || 0), 0),
          pending_balance: bRows.reduce((a, r) => a + (r.pending_balance || 0), 0)
        };
      }

      setKisanData({ rows: kRows, summary: kSum });
      setBuyerData({ rows: bRows, summary: bSum });
      setSearched(true);
    } catch (err) {
      console.error('Error fetching balance sheet:', err);
      setSearched(true);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, [selectedYear]);

  const totalCombinedAmount = (kisanData.summary.net_amount || kisanData.summary.total_amount || 0) + (buyerData.summary.total_amount || 0);
  const totalCombinedPaid = (kisanData.summary.cash_paid || 0) + (buyerData.summary.cash_paid || 0);
  const totalCombinedPending = (kisanData.summary.pending_balance || 0) + (buyerData.summary.pending_balance || 0);

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Form Card */}
        <div style={{ maxWidth: '480px', margin: '0 auto 20px auto', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
            📊 Annual Balance Sheet
          </div>

          <form onSubmit={fetchBalanceSheet} style={{ padding: '16px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Select Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', flex: '1', fontSize: '15px' }}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* View Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                style={{ flex: '1', padding: '6px', fontSize: '13px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: activeTab === 'ALL' ? '#2563eb' : '#f1f5f9', color: activeTab === 'ALL' ? 'white' : '#334155' }}
              >
                Show All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HOME')}
                style={{ flex: '1', padding: '6px', fontSize: '13px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: activeTab === 'HOME' ? '#15803d' : '#f1f5f9', color: activeTab === 'HOME' ? 'white' : '#334155' }}
              >
                🏡 Home (Kisan)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('BUYERS')}
                style={{ flex: '1', padding: '6px', fontSize: '13px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: activeTab === 'BUYERS' ? '#a16207' : '#f1f5f9', color: activeTab === 'BUYERS' ? 'white' : '#334155' }}
              >
                🛍️ Buyers
              </button>
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Get Balance Sheet ({selectedYear})
            </button>
          </form>
        </div>

        {/* Results Section */}
        {searched && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Combined Overall Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', border: '1px solid #bbf7d0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center', backgroundColor: '#f0fdf4' }}>
                <div style={{ color: '#166534', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>🏡 HOME (KISAN) NET TOTAL</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#15803d' }}>₹{Number(kisanData.summary.net_amount || kisanData.summary.total_amount || 0).toLocaleString()}</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', border: '1px solid #fef08a', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center', backgroundColor: '#fefce8' }}>
                <div style={{ color: '#854d0e', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>🛍️ BUYERS GROSS TOTAL</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#a16207' }}>₹{Number(buyerData.summary.total_amount || 0).toLocaleString()}</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', border: '1px solid #bfdbfe', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center', backgroundColor: '#eff6ff' }}>
                <div style={{ color: '#1e40af', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>💵 TOTAL CASH / ADVANCE PAID</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2563eb' }}>₹{Number(totalCombinedPaid).toLocaleString()}</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', border: '1px solid #fca5a5', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center', backgroundColor: '#fef2f2' }}>
                <div style={{ color: '#991b1b', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>⚠️ TOTAL PENDING BALANCE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#dc2626' }}>₹{Number(totalCombinedPending).toLocaleString()}</div>
              </div>
            </div>

            {/* Table 1: Home Bills Balance Sheet */}
            {(activeTab === 'ALL' || activeTab === 'HOME') && (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ color: '#15803d', margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                    - Home Bills (Kisan Balance Sheet) ({selectedYear}) -
                  </h2>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🖨️ Print Report
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  {kisanData.rows.length === 0 ? (
                    <h3 align="center" style={{ color: '#dc2626', margin: '16px 0' }}>No Home / Kisan Bills for {selectedYear}</h3>
                  ) : (
                    <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '650px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>S.No</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Kisan Name</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Bags</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Gross Total (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Net Amount (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Advance Paid (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Pending Balance (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kisanData.rows.map((r, idx) => {
                          const gross = Number(r.total_amount || 0);
                          const net = Number(r.net_amount ?? gross);
                          const adv = Number(r.advance || 0);
                          const pending = Number(r.pending_balance ?? Math.max(0, net - adv));
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ padding: '8px' }}>{idx + 1}</td>
                              <td style={{ padding: '8px' }}>{r.date || `${selectedYear}-01-01`}</td>
                              <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{r.name || 'Kisan'}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{r.no_of_bags || 0}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>₹{gross.toLocaleString()}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#1e40af' }}>₹{net.toLocaleString()}</td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>₹{adv.toLocaleString()}</td>
                              <td style={{ padding: '8px', textAlign: 'right', color: pending > 0 ? '#d97706' : '#16a34a', fontWeight: 'bold' }}>
                                ₹{pending.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: r.paid === 'YES' ? '#16a34a' : '#dc2626' }}>
                                {r.paid || 'NO'}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', borderTop: '2px solid #cbd5e1' }}>
                          <td colSpan="4" align="left" style={{ padding: '10px' }}>Total Home Bills:</td>
                          <td align="right" style={{ padding: '10px' }}>₹{Number(kisanData.summary.total_amount || 0).toLocaleString()}</td>
                          <td align="right" style={{ padding: '10px', color: '#1e40af' }}>₹{Number(kisanData.summary.net_amount || 0).toLocaleString()}</td>
                          <td align="right" style={{ padding: '10px', color: '#dc2626' }}>₹{Number(kisanData.summary.cash_paid || 0).toLocaleString()}</td>
                          <td align="right" style={{ padding: '10px', color: '#d97706' }}>₹{Number(kisanData.summary.pending_balance || 0).toLocaleString()}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Table 2: Buyer Bills Balance Sheet */}
            {(activeTab === 'ALL' || activeTab === 'BUYERS') && (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #a16207' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ color: '#a16207', margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                    - Buyer Bills Balance Sheet ({selectedYear}) -
                  </h2>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ backgroundColor: '#a16207', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🖨️ Print Report
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  {buyerData.rows.length === 0 ? (
                    <h3 align="center" style={{ color: '#dc2626', margin: '16px 0' }}>No Buyer Bills for {selectedYear}</h3>
                  ) : (
                    <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '650px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#a16207', color: 'white' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>S.No</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Buyer Name</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Bags</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Total Amount (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Cash Paid (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Pending Balance (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buyerData.rows.map((r, idx) => {
                          const total = Number(r.total_amount || 0);
                          const paid = Number(r.cash_paid !== undefined ? r.cash_paid : (r.advance || 0));
                          const pending = Number(r.pending_balance ?? Math.max(0, total - paid));
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ padding: '8px' }}>{idx + 1}</td>
                              <td style={{ padding: '8px' }}>{r.date || `${selectedYear}-01-01`}</td>
                              <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{r.name || 'Buyer'}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{r.no_of_bags || 0}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{total.toLocaleString()}</td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#16a34a' }}>₹{paid.toLocaleString()}</td>
                              <td style={{ padding: '8px', textAlign: 'right', color: pending > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                                ₹{pending.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: r.paid === 'YES' ? '#16a34a' : '#dc2626' }}>
                                {r.paid || 'NO'}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', borderTop: '2px solid #cbd5e1' }}>
                          <td colSpan="4" align="left" style={{ padding: '10px' }}>Total Buyer Bills:</td>
                          <td align="right" style={{ padding: '10px' }}>₹{Number(buyerData.summary.total_amount || 0).toLocaleString()}</td>
                          <td align="right" style={{ padding: '10px', color: '#16a34a' }}>₹{Number(buyerData.summary.cash_paid || 0).toLocaleString()}</td>
                          <td align="right" style={{ padding: '10px', color: '#dc2626' }}>₹{Number(buyerData.summary.pending_balance || 0).toLocaleString()}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
