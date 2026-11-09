import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../api/config';
import BillModal from '../components/BillModal';
import Header from '../components/Header';

// Delay (ms) after a single click before the print modal opens.
// Any second click arriving within this window cancels the modal and
// triggers the double-click action instead.
const CLICK_DELAY_MS = 250;

export default function KisanBalance({ user, onLogout }) {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [kisanName, setKisanName] = useState('');
  const [balanceData, setBalanceData] = useState([]);
  const [searched, setSearched] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  // Track which bill id is currently being marked paid to show feedback
  const [markingPaidId, setMarkingPaidId] = useState(null);

  // Single ref holds the pending single-click timer so it can be cancelled
  // from any double-click handler regardless of which bill was clicked.
  const clickTimerRef = useRef(null);

  const years = [];
  for (let y = 2017; y <= 2060; y++) {
    years.push(y);
  }

  const handleGetBalance = async () => {
    try {
      const params = new URLSearchParams({ year: selectedYear });
      if (kisanName) params.set('name', kisanName);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE_URL}/api/kisan-balance?${params}`, { headers });
      if (res.data && res.data.success) {
        setBalanceData(res.data.records || []);
      }
    } catch (e) {
      setBalanceData([]);
    }
    setSearched(true);
  };

  useEffect(() => {
    handleGetBalance();
  }, [selectedYear]);

  // Double-click handler: mark this individual bill as PAID via the existing
  // /api/mark-bill-paid/<id> endpoint, then refresh the balance table.
  // The backend UPDATE is idempotent — calling it repeatedly on an already-paid
  // bill simply sets paid='YES' again without creating duplicates or side-effects.
  const handleMarkPaid = async (bill) => {
    if (bill.paid === 'YES') return; // already paid — nothing to do
    const billId = bill.id;
    if (!billId) return;
    // Prevent a second API call while one is already in flight
    if (markingPaidId === billId) return;

    setMarkingPaidId(billId);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        `${API_BASE_URL}/api/mark-bill-paid/${billId}`,
        { paid: 'YES' },
        { headers }
      );
      if (res.data && res.data.success) {
        // Re-fetch so pending_balance and TOTAL BALANCE reflect the change
        await handleGetBalance();
      }
    } catch (e) {
      console.error('Failed to mark bill paid:', e);
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Single click: schedule the print modal to open after CLICK_DELAY_MS.
  // If a second click arrives within that window the timer is cancelled by
  // handleDoubleClick before it fires.
  const handleClick = (bill) => {
    // Clear any previous pending timer (e.g. user clicked a different row quickly)
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setSelectedBill(bill);
    }, CLICK_DELAY_MS);
  };

  // Double click: cancel the pending single-click timer, then mark as paid.
  const handleDoubleClick = (bill) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    handleMarkPaid(bill);
  };

  // Clean up any dangling timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  // Total balance = sum of backend-computed pending_balance values.
  // This uses the same field the individual rows display, so they stay in sync.
  const totalPendingBalance = balanceData.reduce(
    (acc, b) => acc + Number(b.pending_balance ?? 0),
    0
  );

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Form Card */}
        <div style={{ maxWidth: '450px', margin: '0 auto 20px auto', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
            Kisan Balance
          </div>

          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '120px', fontWeight: 'bold', fontSize: '14px' }}>Select Year:</label>
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

            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '120px', fontWeight: 'bold', fontSize: '14px' }}>Kisan Name:</label>
              <input
                type="text"
                value={kisanName}
                onChange={(e) => setKisanName(e.target.value)}
                placeholder="Enter Kisan Name"
                style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
              />
            </div>

            <button
              type="button"
              onClick={handleGetBalance}
              style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Get Balance
            </button>
          </div>
        </div>

        {/* Balance Report Table Card */}
        {searched && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ color: '#15803d', margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
                - Kisan Ledger & Balance ({selectedYear}) -
              </h2>

              {/* TOTAL BALANCE — sum of all pending_balance values from the backend */}
              {balanceData.length > 0 && (
                <div style={{ backgroundColor: totalPendingBalance === 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${totalPendingBalance === 0 ? '#bbf7d0' : '#fca5a5'}`, borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: totalPendingBalance === 0 ? '#166534' : '#991b1b', marginBottom: '2px' }}>
                    TOTAL BALANCE
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: totalPendingBalance === 0 ? '#15803d' : '#dc2626' }}>
                    ₹{totalPendingBalance.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>S.No.</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Kisan Name</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Net Amount (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Advance Paid (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Remaining Balance (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceData.length === 0 ? (
                    <tr>
                      <td colSpan="8" align="center" style={{ padding: '16px', color: '#dc2626', fontWeight: 'bold' }}>
                        No Kisan ledger records found for {selectedYear}.
                      </td>
                    </tr>
                  ) : (
                    balanceData.map((b, idx) => {
                      const gross = Number(b.total_amount || 0);
                      const net_amount = Number(b.net_amount || 0);
                      const advance = Number(b.advance || 0);
                      // pending_balance is backend-computed: max(0, net − advance), 0 if paid
                      const pending = Number(b.pending_balance ?? Math.max(0, net_amount - advance));
                      const isPaid = b.paid === 'YES';
                      const isMarking = markingPaidId === b.id;

                      return (
                        <tr key={b.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '8px' }}>{idx + 1}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{b.name}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>₹{gross.toLocaleString()}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>₹{net_amount.toLocaleString()}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>₹{advance.toLocaleString()}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: pending === 0 ? '#16a34a' : '#dc2626' }}>₹{pending.toLocaleString()}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: isPaid ? '#16a34a' : '#dc2626' }}>{isPaid ? 'PAID' : 'NOT PAID'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              // Single click: open print modal after a short delay so a
                              // second click can cancel it and trigger mark-paid instead.
                              onClick={() => handleClick(b)}
                              // Double click: cancel the pending modal open; mark as PAID.
                              onDoubleClick={() => handleDoubleClick(b)}
                              disabled={isMarking}
                              title={isPaid ? 'Bill already paid' : 'Click to print · Double-click to mark as PAID'}
                              style={{
                                backgroundColor: isMarking ? '#64748b' : (isPaid ? '#16a34a' : '#2563eb'),
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                cursor: isMarking ? 'wait' : 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                transition: 'background-color 0.15s',
                              }}
                            >
                              {isMarking ? '⏳ Saving…' : (isPaid ? '✅ Print Bill' : '🖨️ Print Bill')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* TOTAL BALANCE footer row */}
                  {balanceData.length > 0 && (
                    <tr style={{ backgroundColor: '#f0fdf4', fontWeight: 'bold', borderTop: '2px solid #15803d' }}>
                      <td colSpan="5" align="right" style={{ padding: '10px', color: '#15803d' }}>
                        TOTAL BALANCE:
                      </td>
                      <td align="right" style={{ padding: '10px', color: totalPendingBalance === 0 ? '#15803d' : '#dc2626', fontSize: '1.05rem' }}>
                        ₹{totalPendingBalance.toLocaleString()}
                      </td>
                      <td colSpan="2" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <BillModal bill={selectedBill} onClose={() => setSelectedBill(null)} />
    </div>
  );
}
