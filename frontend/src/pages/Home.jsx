import axios from 'axios';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/config';
import BillModal from '../components/BillModal';
import Header from '../components/Header';
import TimePicker from '../components/TimePicker';
import UserProfileModal from '../components/UserProfileModal';

// Returns today's date in local timezone as YYYY-MM-DD
function localToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function computeBillFinancials(b) {
  const gross = Number(b.total_amount || (Number(b.no_of_bags || 0) * Number(b.price || 0))) || 0;
  const hamaliPerBag = Number(b.hamali || 0);
  const hamaliDeduction = hamaliPerBag * Number(b.no_of_bags || 0);
  const commission = Math.round(gross * 0.04);
  const damage = Math.round(gross * 0.06);
  const netBeforeAdvance = Math.max(0, gross - commission - hamaliDeduction - damage);
  const advance = Number(b.advance || 0);
  const unsettledBalance = Math.max(0, netBeforeAdvance - advance);
  const isPaid = b.paid === 'YES';
  const remainingDue = isPaid ? 0 : unsettledBalance;
  const settledAmount = isPaid ? (Number(b.paid_amount) || unsettledBalance) : 0;
  const paidDate = b.paid_date || (isPaid ? `${b.date || ''} ${b.time || ''}`.trim() : null);

  return {
    gross,
    hamaliDeduction,
    commission,
    damage,
    netBeforeAdvance,
    advance,
    unsettledBalance,
    isPaid,
    remainingDue,
    settledAmount,
    paidDate,
  };
}

export default function Home({ user, onLogout, onUpdateUser }) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(() => {
    const hasBeenShown = localStorage.getItem('agri_profile_modal_shown');
    if (hasBeenShown === 'true') return false;
    return user && (!user.address || !user.phone || !user.business_name);
  });
  const [billdate, setBilldate] = useState(localToday());
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [kisanDirectory, setKisanDirectory] = useState([]);
  const [channels, setChannels] = useState([{ bags: '', price: '' }]);
  const [hamali, setHamali] = useState(user?.default_hamali || 0);
  const [advance, setAdvance] = useState('');
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
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/delete-bill/${billId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      fetchBills(billdate);
    } catch (err) {
      console.error('Error deleting bill:', err);
      fetchBills(billdate);
    }
  };

  const fetchBills = async (selectedDate) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/home-bills?date=${selectedDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.success) {
        const apiBills = res.data.bills || [];
        setBills(apiBills);
      }
    } catch (err) {
      console.error('Error fetching home bills:', err);
    }
  };

  const handleMarkPaid = async (bill) => {
    const newPaid = bill.paid === 'YES' ? 'NO' : 'YES';
    const nowStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const f = computeBillFinancials(bill);
    const paidAmount = newPaid === 'YES' ? (f.unsettledBalance || 0) : 0;
    const paidDate = newPaid === 'YES' ? nowStr : '';

    // Optimistically update React state immediately
    setBills(prev => prev.map(b => {
      if (b.id === bill.id || (b.bill_group_id && b.bill_group_id === bill.bill_group_id)) {
        return {
          ...b,
          paid: newPaid,
          paid_date: paidDate,
          paid_amount: paidAmount
        };
      }
      return b;
    }));

    if (selectedBill && (selectedBill.id === bill.id || (selectedBill.bill_group_id && selectedBill.bill_group_id === bill.bill_group_id))) {
      setSelectedBill(prev => ({
        ...prev,
        paid: newPaid,
        paid_date: paidDate,
        paid_amount: paidAmount
      }));
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/mark-bill-paid/${bill.id}`,
        {
          paid: newPaid,
          paid_date: paidDate,
          paid_amount: paidAmount
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      fetchBills(tableDate || billdate);
    } catch (err) {
      console.error('Error marking bill paid:', err);
      fetchBills(tableDate || billdate);
    }
  };

  const fetchKisanDirectory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/kisans`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.success) {
        setKisanDirectory(res.data.kisans || []);
      }
    } catch (e) { }
  };

  useEffect(() => {
    fetchBills(billdate);
    fetchKisanDirectory();
  }, [billdate]);

  // Separate effect: re-fetch when user picks a different date in the table filter
  useEffect(() => {
    fetchBills(tableDate);
  }, [tableDate]);

  const handleNameChange = (val) => {
    setName(val);
    const trimmed = (val || '').trim().toLowerCase();
    if (!trimmed) return;
    // Auto-fetch mobile from directory if match found
    const match = kisanDirectory.find(k => (k.name || '').trim().toLowerCase() === trimmed);
    if (match && match.mobile) {
      setMobile(match.mobile);
      return;
    }
    // Also check loaded bills
    const billMatch = bills.find(b => (b.name || '').trim().toLowerCase() === trimmed && b.mobile);
    if (billMatch && billMatch.mobile) {
      setMobile(billMatch.mobile);
    }
  };

  const resolveBillForModal = (b, f) => {
    let resolvedMobile = b.mobile;
    if (!resolvedMobile) {
      const match = kisanDirectory.find(
        (k) => (k.name || '').trim().toLowerCase() === (b.name || '').trim().toLowerCase()
      );
      resolvedMobile = match?.mobile || '';
    }
    return {
      ...b,
      ...f,
      mobile: resolvedMobile,
      paid_date: f.paidDate,
      paid_amount: f.settledAmount,
    };
  };

  const handleEditClick = (b) => {
    if (!b) return;
    setEditingBillId(b.id);
    setName(b.name || '');
    setMobile(b.mobile || '');
    setBilldate(b.date || b.billdate || billdate);
    if (b.channels && b.channels.length > 0) {
      setChannels(b.channels.map(c => ({
        bags: c.bags ?? '',
        price: c.price ?? '',
        kisanName: c.kisanName || c.kisan_name || ''
      })));
    } else {
      setChannels([{ bags: b.no_of_bags || '', price: b.price || '' }]);
    }
    setHamali(b.hamali || 0);
    setAdvance(b.advance || '');
    setBagsSold(b.bagsSold || '');
    setPriceSold(b.priceSold || '');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { }
  };

  const handleCancelEdit = () => {
    setEditingBillId(null);
    setName('');
    setMobile('');
    setChannels([{ bags: '', price: '' }]);
    setHamali(user?.default_hamali || 5);
    setAdvance('');
    setBagsSold('');
    setPriceSold('');
  };

  const addChannel = (e) => {
    e.preventDefault();
    if (channels.length < 200) {
      setChannels([...channels, { bags: '', price: '' }]);
    } else {
      alert("Maximum channels 200 only");
    }
  };

  const handleChannelChange = (index, field, value) => {
    const updated = [...channels];
    updated[index][field] = value;
    setChannels(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (Number(advance) < 0 || Number(hamali) < 0 || Number(bagsSold) < 0 || Number(priceSold) < 0) {
      alert("Invalid input! Negative values are not allowed.");
      return;
    }

    const validChannels = channels
      .map(c => ({
        bags: Number(c.bags) || 0,
        price: Number(c.price) || 0,
        kisanName: c.kisanName || c.kisan_name || ''
      }))
      .filter(c => c.bags > 0 && c.price >= 0);

    if (validChannels.length === 0) {
      alert("Please enter valid Bags and Price for at least one channel!");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (editingBillId) {
        const res = await axios.put(`${API_BASE_URL}/api/update-bill/${editingBillId}`, {
          name: name || 'Kisan',
          mobile: mobile ? mobile.trim() : '',
          billdate,
          date: billdate,
          time: advanceTime,
          advanceTime,
          items: validChannels,
          hamali: Number(hamali) || 0,
          advance: Number(advance) || 0,
          bagsSold,
          priceSold
        }, { headers });

        if (res.data && res.data.success) {
          alert('Updated successfully');
        } else {
          alert(res.data?.message || 'Update failed');
          return;
        }
      } else {
        const res = await axios.post(`${API_BASE_URL}/api/add-bill`, {
          name: name || 'Kisan',
          mobile: mobile ? mobile.trim() : '',
          billdate,
          advanceTime,
          items: validChannels,
          hamali: Number(hamali) || 0,
          advance: Number(advance) || 0,
          bagsSold,
          priceSold
        }, { headers });

        if (res.data && res.data.success) {
          alert('Saved successfully');
        } else {
          alert(res.data?.message || 'Save failed');
          return;
        }
      }
    } catch (err) {
      console.error('Error saving bill:', err);
      alert(err.response?.data?.message || 'Failed to save bill. Please try again.');
      return;
    }

    setEditingBillId(null);
    setName('');
    setMobile('');
    setChannels([{ bags: '', price: '' }]);
    setHamali(user?.default_hamali || 5);
    setAdvance('');
    setBagsSold('');
    setPriceSold('');
    fetchBills(billdate);
    fetchKisanDirectory();
  };

  const totalBagsToday = bills.reduce((acc, b) => acc + (Number(b.no_of_bags) || 0), 0);
  const totalGrossToday = bills.reduce((acc, b) => acc + (Number(b.no_of_bags * b.price) || 0), 0);
  const totalYetToCollect = bills.reduce((acc, b) => acc + computeBillFinancials(b).remainingDue, 0);
  const totalCollectedToday = bills.reduce((acc, b) => {
    const f = computeBillFinancials(b);
    return acc + f.advance + (f.isPaid ? f.settledAmount : 0);
  }, 0);
  const unpaidBillsCount = bills.filter(b => b.paid !== 'YES').length;
  const paidBillsCount = bills.filter(b => b.paid === 'YES').length;

  const customerBreakdown = Object.values(
    bills.reduce((acc, b) => {
      const custName = (b.name || 'Unknown').trim();
      const key = custName.toLowerCase();
      if (!acc[key]) {
        acc[key] = {
          name: custName,
          totalBags: 0,
          grossTotal: 0,
          pendingAmount: 0,
          paidAmount: 0,
          advanceTotal: 0,
          bills: [],
          allPaid: true,
        };
      }
      const f = computeBillFinancials(b);
      acc[key].totalBags += Number(b.no_of_bags || 0);
      acc[key].grossTotal += f.gross;
      acc[key].pendingAmount += f.remainingDue;
      acc[key].advanceTotal += f.advance;
      acc[key].paidAmount += (f.isPaid ? f.settledAmount : 0);
      if (!f.isPaid) {
        acc[key].allPaid = false;
      }
      acc[key].bills.push({ ...b, financials: f });
      return acc;
    }, {})
  ).sort((a, b) => b.pendingAmount - a.pendingAmount);

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Responsive Container for Form & Today's Activity Summary */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

          {/* Add Bill Form Card */}
          <div style={{ flex: '1 1 340px', minWidth: '280px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              Kisan Bills
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
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Kisan Name:</label>
                <input
                  type="text"
                  list="kisan-name-suggestions"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Kisan Name"
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '140px' }}
                />
                <datalist id="kisan-name-suggestions">
                  {Array.from(new Set([
                    ...kisanDirectory.map(k => k.name).filter(Boolean),
                    ...bills.map(b => b.name).filter(Boolean)
                  ])).map((kName, idx) => (
                    <option key={idx} value={kName} />
                  ))}
                </datalist>
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Mobile No:</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Kisan Mobile Number"
                  maxLength="15"
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '140px' }}
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <a href="#addChannel" onClick={addChannel} style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 'bold', fontSize: '14px' }}>
                  Click to add a Channel
                </a>
              </div>

              <div style={{ marginBottom: '12px' }}>
                {channels.map((ch, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={ch.bags}
                      onChange={(e) => handleChannelChange(idx, 'bags', e.target.value)}
                      placeholder="No. Of Bags"
                      required
                      style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '110px' }}
                    />
                    <input
                      type="number"
                      value={ch.price}
                      onChange={(e) => handleChannelChange(idx, 'price', e.target.value)}
                      placeholder="Price per Bag"
                      required
                      style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '110px' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Hamali / Bag:</label>
                <input
                  type="number"
                  value={hamali}
                  onChange={(e) => setHamali(e.target.value)}
                  placeholder="Hamali Per Bag"
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '140px' }}
                />
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
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Local Sale Price:</label>
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
                  {editingBillId ? 'Update Bill' : 'Submit Bill'}
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

          {/* Replacement for Cut-Off Print Bills Image: Today's Summary & Quick Receipts Cards */}
          <div style={{ flex: '1 1 340px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, color: '#15803d', fontSize: '1.1rem', fontWeight: 'bold' }}>📊 Today's Business Summary</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{billdate}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '8px' }}>
                <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>TOTAL BILLS</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#15803d' }}>{bills.length}</div>
                </div>

                <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>TOTAL BAGS</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1d4ed8' }}>{totalBagsToday}</div>
                </div>

                <div style={{ backgroundColor: '#fefce8', padding: '8px', borderRadius: '8px', border: '1px solid #fef08a', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#854d0e', fontWeight: 'bold' }}>GROSS TOTAL</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a16207' }}>₹{totalGrossToday.toLocaleString()}</div>
                </div>

                <div style={{ backgroundColor: '#fef2f2', padding: '8px', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 'bold' }}>YET TO COLLECT</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#dc2626' }}>₹{totalYetToCollect.toLocaleString()}</div>
                  <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px' }}>{unpaidBillsCount} unpaid</div>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '8px', border: '1px solid #86efac', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>COLLECTED / PAID</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#15803d' }}>₹{totalCollectedToday.toLocaleString()}</div>
                  <div style={{ fontSize: '10px', color: '#166534', marginTop: '2px' }}>{paidBillsCount} paid</div>
                </div>
              </div>

              {/* Live Pending Amount from Each Customer Breakdown */}
              <div style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                    👥 Pending Amount from Each Customer ({customerBreakdown.length})
                  </strong>
                  <span style={{ fontSize: '11px', color: totalYetToCollect > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                    {totalYetToCollect > 0 ? `₹${totalYetToCollect.toLocaleString()} Pending` : 'All Settled ✓'}
                  </span>
                </div>

                {customerBreakdown.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>No bills found for this date.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {customerBreakdown.map((cust, cIdx) => (
                      <div
                        key={cIdx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: cust.allPaid ? '#f0fdf4' : '#fff1f2',
                          border: cust.allPaid ? '1px solid #bbf7d0' : '1px solid #fecdd3',
                          fontSize: '12px'
                        }}
                      >
                        <div>
                          <strong style={{ color: '#0f172a' }}>{cust.name}</strong>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>({cust.totalBags} Bags)</span>
                          {cust.advanceTotal > 0 && (
                            <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '11px' }}>
                              Adv: ₹{cust.advanceTotal.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div>
                          {cust.allPaid ? (
                            <span style={{ color: '#15803d', fontWeight: 'bold', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
                              ✓ Paid (₹0 Due)
                            </span>
                          ) : (
                            <span style={{ color: '#b91c1c', fontWeight: 'bold', backgroundColor: '#ffe4e6', padding: '2px 8px', borderRadius: '10px' }}>
                              ₹{cust.pendingAmount.toLocaleString()} Pending
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Receipts List Cards */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: 'bold' }}>📄 Quick Print & Send Receipts</h3>

              {bills.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No bills created for today yet. Fill out the form to add a bill.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {bills.map((b) => {
                    const f = computeBillFinancials(b);
                    return (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{b.name}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {b.no_of_bags} Bags @ ₹{b.price} = <span style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{f.gross.toLocaleString()}</span>
                            {f.isPaid ? (
                              <span style={{ marginLeft: '8px', color: '#15803d', fontWeight: 'bold' }}>• ₹0 Due (Paid ✓)</span>
                            ) : (
                              <span style={{ marginLeft: '8px', color: '#dc2626', fontWeight: 'bold' }}>• ₹{f.remainingDue.toLocaleString()} Due</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedBill(resolveBillForModal(b, f))}
                            style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            📄 Invoice
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <br />

        {/* Bills On This Day Table (Responsive Scrollable) */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
          <h2 align="center" style={{ color: '#15803d', margin: '0 0 16px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>
            - Bills On This Day ({tableDate}) -&nbsp;
            <input
              type="date"
              value={tableDate}
              onChange={(e) => setTableDate(e.target.value)}
              style={{ border: '2px solid #15803d', padding: '3px 7px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', backgroundColor: '#f0fdf4', color: '#0f172a', verticalAlign: 'middle' }}
            />
          </h2>

          <div style={{ overflowX: 'auto' }}>
            {bills.length === 0 ? (
              <h3 align="center" style={{ color: '#dc2626', margin: '16px 0' }}>No Bills Found</h3>
            ) : (
              <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>S.No</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Kisan Name</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Bags</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Price</th>
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
                    const f = computeBillFinancials(b);
                    return (
                      <tr key={b.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px' }}>{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{b.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{b.no_of_bags}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>₹{b.price}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{f.gross.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                          {f.isPaid ? (
                            <div>
                              <span style={{ color: '#16a34a', fontSize: '14px' }}>₹0</span>
                              <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>
                                ✓ Paid (₹{f.settledAmount.toLocaleString()})
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span style={{ color: '#1e40af' }}>₹{f.remainingDue.toLocaleString()}</span>
                              {f.advance > 0 && (
                                <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'normal' }}>
                                  (-₹{f.advance.toLocaleString()} adv)
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>₹{Number(b.advance || 0).toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: '13px' }}>
                          <div>{b.date || billdate} {b.time || b.advanceTime || ''}</div>
                          {f.isPaid && f.paidDate && (
                            <div style={{ fontSize: '10px', color: '#15803d', fontWeight: 'bold' }}>
                              Paid: {f.paidDate}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: f.isPaid ? '#16a34a' : '#dc2626' }}>{b.paid || 'NO'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedBill(resolveBillForModal(b, f))}
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
                              style={{ backgroundColor: f.isPaid ? '#64748b' : '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              {f.isPaid ? 'Unmark' : '✓ Paid'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBill(resolveBillForModal(b, f));
                              }}
                              style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              📱 SMS
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

      <BillModal bill={selectedBill} onClose={() => setSelectedBill(null)} />

      {confirmDeleteId !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: '1.25rem' }}>Confirm Delete</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#334155' }}>
              Are you sure you want to delete this bill?
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

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onSaveSuccess={(updated) => {
          if (onUpdateUser) onUpdateUser(updated);
        }}
      />
    </div>
  );
}
