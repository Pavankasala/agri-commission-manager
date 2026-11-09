import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import TimePicker from '../components/TimePicker';
import BillModal from '../components/BillModal';
import { API_BASE_URL } from '../api/config';

// Returns today's date in local timezone as YYYY-MM-DD
function localToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function BuyersDetails({ user, onLogout }) {
  const [billdate, setBilldate] = useState(localToday());
  const [name, setName] = useState('');
  const [channels, setChannels] = useState([{ kisanName: '', bags: '', price: '' }]);
  const [hamali, setHamali] = useState(user?.default_hamali || 0);
  const [advance, setAdvance] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [advanceDate, setAdvanceDate] = useState(localToday());
  const [advanceTime, setAdvanceTime] = useState(() => {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${period}`;
  });
  const [bagsSold, setBagsSold] = useState('');
  const [priceSold, setPriceSold] = useState('');
  const [bills, setBills] = useState([]);
  const [tableDate, setTableDate] = useState(localToday());
  const [selectedBill, setSelectedBill] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingBillId, setEditingBillId] = useState(null);

  const handleDeleteBill = async (billId) => {
    setBills(prev => prev.filter(b => b.id !== billId));
    try {
      await axios.delete(`${API_BASE_URL}/api/delete-bill/${billId}`);
      fetchBills(billdate);
    } catch (err) { }
  };

  const fetchBills = async (selectedDate) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/buyer-bills?date=${selectedDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.success) {
        const apiBills = res.data.bills || [];
        setBills(apiBills);
      }
    } catch (err) {
      setBills([]);
    }
  };

  const handleMarkPaid = async (bill) => {
    const newPaid = bill.paid === 'YES' ? 'NO' : 'YES';
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/mark-bill-paid/${bill.id}`, { paid: newPaid }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      fetchBills(billdate);
    } catch (err) {
      console.error('Error marking bill paid:', err);
    }
  };

  useEffect(() => {
    fetchBills(billdate);
  }, [billdate]);

  // Separate effect: re-fetch when user picks a different date in the table filter
  useEffect(() => {
    fetchBills(tableDate);
  }, [tableDate]);

  const addChannel = (e) => {
    e.preventDefault();
    if (channels.length < 200) {
      setChannels([...channels, { kisanName: '', bags: '', price: '' }]);
    } else {
      alert("Maximum channels 200 only");
    }
  };

  const handleChannelChange = (index, field, value) => {
    const updated = [...channels];
    updated[index][field] = value;
    setChannels(updated);
  };

  const handleEditClick = (b) => {
    setEditingBillId(b.id);
    setName(b.name || '');
    setBilldate(b.date || b.billdate || billdate);
    if (b.channels && b.channels.length > 0) {
      setChannels(b.channels);
    } else {
      setChannels([{ kisanName: b.name || '', bags: b.no_of_bags || '', price: b.price || '' }]);
    }
    setHamali(b.hamali || 0);
    setAdvance(b.advance || '');
    setPaymentMode(b.paymentMode || b.payment_mode || 'CASH');
    setBagsSold(b.bagsSold || '');
    setPriceSold(b.priceSold || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingBillId(null);
    setName('');
    setChannels([{ kisanName: '', bags: '', price: '' }]);
    setAdvance('');
    setPaymentMode('CASH');
    setBagsSold('');
    setPriceSold('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const c of channels) {
      if (Number(c.bags) < 0 || Number(c.price) < 0) {
        alert("Invalid input! Bags and Price cannot be negative numbers.");
        return;
      }
    }
    if (Number(advance) < 0 || Number(hamali) < 0 || Number(bagsSold) < 0 || Number(priceSold) < 0) {
      alert("Invalid input! Negative values are not allowed.");
      return;
    }

    const totalBags = channels.reduce((acc, c) => acc + (Number(c.bags) || 0), 0);
    const avgPrice = channels.length > 0 && Number(channels[0].price) ? Number(channels[0].price) : (Number(priceSold) || 0);

    const billObj = {
      id: editingBillId || Date.now(),
      name: name || 'Buyer',
      billdate: billdate,
      date: billdate,
      time: advanceTime,
      advanceTime: advanceTime,
      channels: channels,
      no_of_bags: totalBags,
      price: avgPrice,
      hamali: Number(hamali) || 0,
      advance: Number(advance) || 0,
      bagsSold: bagsSold,
      priceSold: priceSold,
      type: 'BUYER',
      paid: 'NO'
    };

    try {
      if (editingBillId) {
        await axios.put(`${API_BASE_URL}/api/update-buyer-bill/${editingBillId}`, {
          name,
          billdate,
          advanceTime,
          items: channels,
          hamali,
          advance,
          paymentMode,
          bagsSold,
          priceSold
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/add-buyer-bill`, {
          name,
          billdate,
          advanceTime,
          items: channels,
          hamali,
          advance,
          paymentMode,
          bagsSold,
          priceSold
        });
      }
    } catch (err) { }

    alert(editingBillId ? 'Updated successfully' : 'Saved successfully');
    setEditingBillId(null);
    setName('');
    setChannels([{ kisanName: '', bags: '', price: '' }]);
    setAdvance('');
    setPaymentMode('CASH');
    setBagsSold('');
    setPriceSold('');
    fetchBills(billdate);
  };

  const totalBagsToday = bills.reduce((acc, b) => acc + (Number(b.no_of_bags) || 0), 0);
  const totalGrossToday = bills.reduce((acc, b) => acc + (Number(b.no_of_bags * b.price) || 0), 0);

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Responsive Container for Form & Today's Buyer Activity Summary */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

          {/* Buyers Details Form Card */}
          <div style={{ flex: '1 1 340px', minWidth: '280px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              {editingBillId ? 'Edit Buyer Bill' : 'Buyer Bills'}
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
                <input
                  type="date"
                  value={billdate}
                  onChange={(e) => setBilldate(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '140px' }}
                />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Buyer Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Buyer Name"
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '140px' }}
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <a href="#addChannel" onClick={addChannel} style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 'bold', fontSize: '14px' }}>
                  + Click to add a Channel
                </a>
              </div>

              <div style={{ marginBottom: '12px', overflowX: 'auto' }}>
                <table width="100%" border="0" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '6px', color: '#1e293b', fontSize: '13px', textAlign: 'left' }}>Kisan Name</th>
                      <th style={{ padding: '6px', color: '#1e293b', fontSize: '13px', textAlign: 'center' }}>No. of Bags</th>
                      <th style={{ padding: '6px', color: '#1e293b', fontSize: '13px', textAlign: 'center' }}>Price per Bag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '4px' }}>
                          <input
                            type="text"
                            value={ch.kisanName}
                            onChange={(e) => handleChannelChange(idx, 'kisanName', e.target.value)}
                            placeholder="Kisan Name"
                            required
                            style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input
                            type="number"
                            value={ch.bags}
                            onChange={(e) => handleChannelChange(idx, 'bags', e.target.value)}
                            placeholder="No. of Bags"
                            required
                            style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input
                            type="number"
                            value={ch.price}
                            onChange={(e) => handleChannelChange(idx, 'price', e.target.value)}
                            placeholder="Price per Bag"
                            required
                            style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', boxSizing: 'border-box' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Advance:</label>
                <div style={{ display: 'flex', gap: '6px', flex: '1', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                    placeholder="Amount"
                    style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', width: '80px' }}
                  />
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#0f172a', cursor: 'pointer' }}
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="UPI">📱 UPI Payment</option>
                  </select>
                  <input
                    type="date"
                    value={advanceDate}
                    onChange={(e) => setAdvanceDate(e.target.value)}
                    style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '120px' }}
                  />
                  <TimePicker value={advanceTime} onChange={(t) => setAdvanceTime(t)} />
                </div>
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Price of Sold Bag:</label>
                <input
                  type="number"
                  value={priceSold}
                  onChange={(e) => setPriceSold(e.target.value)}
                  placeholder="Price of Sold Bag"
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '140px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{
                    flex: '1',
                    padding: '10px',
                    backgroundColor: editingBillId ? '#eab308' : '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {editingBillId ? 'Update Details' : 'Submit'}
                </button>
                {editingBillId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#64748b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right Column Card: Today's Buyer Activity Summary */}
          <div style={{ flex: '1 1 340px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#15803d', fontSize: '1.1rem', fontWeight: 'bold' }}>📊 Today's Buyer Summary</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#166534', fontWeight: 'bold' }}>BUYER BILLS</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#15803d' }}>{bills.length}</div>
                </div>

                <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold' }}>TOTAL BAGS</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1d4ed8' }}>{totalBagsToday}</div>
                </div>

                <div style={{ backgroundColor: '#fefce8', padding: '10px', borderRadius: '8px', border: '1px solid #fef08a', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#854d0e', fontWeight: 'bold' }}>GROSS TOTAL</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a16207' }}>₹{totalGrossToday.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Quick Receipts List Card */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: 'bold' }}>📄 Quick Print & Send Receipts</h3>

              {bills.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No buyer bills created for today yet. Fill out the form to add a buyer bill.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {bills.map((b) => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{b.name}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {b.no_of_bags} Bags @ ₹{b.price} = <span style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{b.no_of_bags * b.price}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedBill(b)}
                          style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          📄 Invoice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <br />

        {/* Buyer Bills On This Day Table (Responsive Container) */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
          <h2 align="center" style={{ color: '#15803d', margin: '0 0 16px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>
            - Buyer Bills On This Day ({tableDate}) -&nbsp;
            <input
              type="date"
              value={tableDate}
              onChange={(e) => setTableDate(e.target.value)}
              style={{ border: '2px solid #15803d', padding: '3px 7px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', backgroundColor: '#f0fdf4', color: '#0f172a', verticalAlign: 'middle' }}
            />
          </h2>

          <div style={{ overflowX: 'auto' }}>
            {bills.length === 0 ? (
              <h3 align="center" style={{ color: '#dc2626', margin: '16px 0' }}>No Buyer Bills Found</h3>
            ) : (
              <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>S.No</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Buyer Name</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Bags</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Net Amount (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Advance (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Date & Time</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Paid</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, idx) => {
                    const gross = Number(b.total_amount || (b.no_of_bags * b.price)) || 0;
                    // BUYER: net = gross (no commission/hamali deductions)
                    const net = gross;
                    return (
                      <tr key={b.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px' }}>{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{b.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{b.no_of_bags}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{gross.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#1e40af' }}>₹{net.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>
                          ₹{Number(b.advance || 0).toLocaleString()}
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              color: (b.paymentMode || b.payment_mode) === 'UPI' ? '#2563eb' : '#15803d',
                              backgroundColor: (b.paymentMode || b.payment_mode) === 'UPI' ? '#eff6ff' : '#f0fdf4',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: `1px solid ${(b.paymentMode || b.payment_mode) === 'UPI' ? '#bfdbfe' : '#bbf7d0'}`,
                              marginLeft: '6px',
                              fontWeight: 'bold'
                            }}
                          >
                            {(b.paymentMode || b.payment_mode) === 'UPI' ? '📱 UPI' : '💵 Cash'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: '13px' }}>{b.date || billdate} {b.time || b.advanceTime || ''}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: b.paid === 'YES' ? '#16a34a' : '#dc2626' }}>{b.paid || 'NO'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedBill(b)}
                              style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(b)}
                              style={{ backgroundColor: '#eab308', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(b)}
                              style={{ backgroundColor: b.paid === 'YES' ? '#64748b' : '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              {b.paid === 'YES' ? 'Unmark' : '✓ Paid'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(b.id)}
                              style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Delete
                            </button>
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

      <BillModal bill={selectedBill} isBuyerPage={true} onClose={() => setSelectedBill(null)} />

      {confirmDeleteId !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: '1.25rem' }}>Confirm Delete</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#334155' }}>
              Are you sure you want to delete this buyer bill?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  handleDeleteBill(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                style={{ backgroundColor: '#64748b', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
