import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import BillModal from '../components/BillModal';
import { API_BASE_URL } from '../api/config';

export default function Bills({ user, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBags, setEditBags] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editAdvance, setEditAdvance] = useState('');
  const [editDate, setEditDate] = useState('');

  const loadBills = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE_URL}/api/home-bills?date=${selectedDate}`, { headers });
      if (res.data && res.data.success) {
        setBills(res.data.bills || []);
      }
    } catch (e) {
      setBills([]);
    }
  };

  useEffect(() => {
    loadBills();
  }, [selectedDate]);

  const handleConfirmBill = async (billId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API_BASE_URL}/api/confirm-bill/${billId}`, {}, { headers });
      await loadBills();
      alert('Bill confirmed and marked as paid!');
    } catch (e) {
      alert('Failed to confirm bill');
    }
  };

  const handleConfirmAllBills = async () => {
    if (bills.length === 0) return;
    const pendingBills = bills.filter(b => !(b.paid === 'YES' || b.confirmed));
    if (pendingBills.length === 0) {
      alert('All bills for this date are already confirmed!');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await Promise.all(
        pendingBills.map(b => axios.post(`${API_BASE_URL}/api/confirm-bill/${b.id}`, {}, { headers }).catch(() => null))
      );
      await loadBills();
      alert('All bills for this date confirmed successfully!');
    } catch (e) {
      alert('Failed to confirm all bills');
    }
  };

  const handleOpenEdit = (b) => {
    setEditingBill(b);
    setEditName(b.name || '');
    setEditBags(String(b.no_of_bags || ''));
    setEditPrice(String(b.price || ''));
    setEditAdvance(String(b.advance || '0'));
    setEditDate(b.date || b.billdate || selectedDate);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingBill) return;

    if (Number(editBags) < 0 || Number(editPrice) < 0 || Number(editAdvance) < 0) {
      alert("Invalid input! Negative values are not allowed for bags, price, or advance.");
      return;
    }

    const newBags = Number(editBags) || 0;
    const newPrice = Number(editPrice) || 0;
    const newAdvance = Number(editAdvance) || 0;

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API_BASE_URL}/api/update-bill/${editingBill.id}`, {
        name: editName,
        no_of_bags: newBags,
        price: newPrice,
        advance: newAdvance,
        date: editDate
      }, { headers });
      alert('Bill updated successfully!');
      setEditingBill(null);
      loadBills();
    } catch (e) {
      alert('Failed to update bill');
    }
  };

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Form Card */}
        <div style={{ maxWidth: '420px', margin: '0 auto 20px auto', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
            Confirm Home Page Bills
          </div>

          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Select Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
              />
            </div>

            <button
              type="button"
              onClick={loadBills}
              style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Get Bills To Confirm
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ color: '#15803d', margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
              - Confirmed & Pending Home Bills ({selectedDate}) -
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleConfirmAllBills}
                style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ✓ Confirm All Bills
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🖨️ Print All Bills
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {bills.length === 0 ? (
              <h3 align="center" style={{ color: '#dc2626', margin: '16px 0' }}>No Home Bills Found for this Date</h3>
            ) : (
              <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '750px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>S.No.</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Kisan Name</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>No. of Bags</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Price / Bag</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total Amount</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Advance Paid</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Date & Time</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Confirm & Edit Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, idx) => {
                    const bags = Number(b.no_of_bags) || 0;
                    const price = Number(b.price) || 0;
                    const total = bags * price;
                    const advance = Number(b.advance) || 0;
                    
                    // Bill status is confirmed when paid === 'YES' OR confirmed === true OR advance >= total (when total > 0)
                    const isConfirmed = b.paid === 'YES' || Boolean(b.confirmed) || (total > 0 && advance >= total);

                    return (
                      <tr key={b.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px' }}>{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{b.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{bags}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>₹{price}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{total.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>₹{advance.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{b.date || selectedDate} {b.time || b.advanceTime || ''}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: isConfirmed ? '#16a34a' : '#dc2626' }}>
                          {isConfirmed ? 'CONFIRMED (PAID)' : 'PENDING'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedBill(b)}
                              style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              View Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(b)}
                              style={{ backgroundColor: '#eab308', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            {!isConfirmed && (
                              <button
                                type="button"
                                onClick={() => handleConfirmBill(b.id)}
                                style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                Confirm
                              </button>
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

      {/* Bill View Invoice Modal */}
      <BillModal bill={selectedBill} onClose={() => setSelectedBill(null)} />

      {/* Edit Bill Modal */}
      {editingBill && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '1.25rem', textAlign: 'center', fontWeight: 'bold' }}>
              Edit Bill Details
            </h3>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>Date:</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>Kisan Name:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>No. of Bags:</label>
                <input
                  type="number"
                  value={editBags}
                  onChange={(e) => setEditBags(e.target.value)}
                  required
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>Price per Bag (₹):</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>Advance Paid (₹):</label>
                <input
                  type="number"
                  value={editAdvance}
                  onChange={(e) => setEditAdvance(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  style={{ backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 20px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
