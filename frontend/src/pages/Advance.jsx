import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function Advance({ user, onLogout }) {
  const [advanceDate, setAdvanceDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [multiDate, setMultiDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedKisan, setSelectedKisan] = useState('');
  const [singleAmount, setSingleAmount] = useState('0');
  const [editingAdvanceId, setEditingAdvanceId] = useState(null);

  // Multi advance state for list of kisans
  const [multiAdvances, setMultiAdvances] = useState({});

  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterKisan, setFilterKisan] = useState('');
  const [advanceList, setAdvanceList] = useState([]);
  const [searched, setSearched] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [kisanOptions, setKisanOptions] = useState([]);

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const fetchKisans = async () => {
      try {
        const headers = getAuthHeader();
        const [homeRes, kisansRes, buyerRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/home-bills`, { headers }),
          axios.get(`${API_BASE_URL}/api/kisans`, { headers }),
          axios.get(`${API_BASE_URL}/api/buyer-bills`, { headers })
        ]);

        let extraNames = [];
        if (homeRes.status === 'fulfilled' && homeRes.value.data?.success && Array.isArray(homeRes.value.data.bills)) {
          extraNames.push(...homeRes.value.data.bills.map(b => b.name));
        }
        if (kisansRes.status === 'fulfilled' && kisansRes.value.data?.success && Array.isArray(kisansRes.value.data.kisans)) {
          extraNames.push(...kisansRes.value.data.kisans.map(k => k.name));
        }
        if (buyerRes.status === 'fulfilled' && buyerRes.value.data?.success && Array.isArray(buyerRes.value.data.bills)) {
          buyerRes.value.data.bills.forEach(b => {
            if (b.channels && Array.isArray(b.channels)) {
              b.channels.forEach(ch => {
                if (ch.kisanName) extraNames.push(ch.kisanName);
              });
            }
          });
        }

        const validNames = extraNames.filter(Boolean).map(n => n.trim());
        const unique = Array.from(new Set(validNames));
        setKisanOptions(unique);
      } catch (e) { }
    };
    fetchKisans();
  }, []);

  useEffect(() => {
    setMultiAdvances(prev => {
      const updated = { ...prev };
      kisanOptions.forEach(k => {
        if (updated[k] === undefined) updated[k] = '0';
      });
      return updated;
    });
  }, [kisanOptions]);

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedKisan) {
      alert("Please select a Kisan");
      return;
    }
    if (Number(singleAmount) < 0) {
      alert("Invalid input! Advance amount cannot be negative.");
      return;
    }

    try {
      if (editingAdvanceId) {
        await axios.put(`${API_BASE_URL}/api/update-advance/${editingAdvanceId}`, {
          name: selectedKisan,
          date: advanceDate,
          amount: Number(singleAmount) || 0
        }, { headers: getAuthHeader() });
        alert(`Advance updated successfully for ${selectedKisan}`);
      } else {
        await axios.post(`${API_BASE_URL}/api/advance`, {
          name: selectedKisan,
          date: advanceDate,
          amount: Number(singleAmount) || 0
        }, { headers: getAuthHeader() });
        alert(`Advance of ₹${singleAmount} added for ${selectedKisan}`);
      }
    } catch (err) { }

    setEditingAdvanceId(null);
    setFilterDate(advanceDate);
    setFilterKisan(selectedKisan);
    setSelectedKisan('');
    setSingleAmount('0');
    fetchAdvanceDetails(advanceDate, selectedKisan);
  };

  const handleMultiChange = (kisan, value) => {
    setMultiAdvances(prev => ({
      ...prev,
      [kisan]: value
    }));
  };

  const handleMultiSubmit = async (e) => {
    e.preventDefault();
    const activeAdvances = {};
    Object.entries(multiAdvances).forEach(([kisan, val]) => {
      const amt = Number(val);
      if (amt > 0) {
        activeAdvances[kisan] = amt;
      }
    });

    if (Object.keys(activeAdvances).length === 0) {
      alert("Please enter advance amount greater than 0 for at least one Kisan");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/add-multi-advance`, {
        date: multiDate,
        advances: activeAdvances
      }, { headers: getAuthHeader() });
      alert(`Multi Advance saved for ${Object.keys(activeAdvances).length} kisans successfully`);
      const reset = {};
      kisanOptions.forEach(k => { reset[k] = '0'; });
      setMultiAdvances(reset);
      setFilterDate(multiDate);
      setFilterKisan('');
      fetchAdvanceDetails(multiDate, '');
    } catch (err) { }
  };

  const handleEditAdvance = (item) => {
    setEditingAdvanceId(item.id);
    setSelectedKisan(item.name || '');
    setAdvanceDate(item.date || item.billdate || advanceDate);
    setSingleAmount(String(item.advance || item.amount || 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingAdvanceId(null);
    setSelectedKisan('');
    setSingleAmount('0');
  };

  const handleDeleteAdvance = async (id) => {
    setAdvanceList(prev => prev.filter(b => b.id !== id));
    try {
      await axios.delete(`${API_BASE_URL}/api/delete-advance/${id}`, { headers: getAuthHeader() });
      fetchAdvanceDetails();
    } catch (e) { }
  };

  const fetchAdvanceDetails = async (overrideDate = filterDate, overrideKisan = filterKisan) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/advances?date=${overrideDate}&kisan=${overrideKisan}`, { headers: getAuthHeader() });
      if (res.data && res.data.success) {
        setAdvanceList(res.data.advances || []);
      }
    } catch (e) {
      setAdvanceList([]);
    }
    setSearched(true);
  };

  useEffect(() => {
    fetchAdvanceDetails(filterDate, filterKisan);
  }, []);

  const totalAdvanceAmount = advanceList.reduce((acc, b) => acc + (Number(b.advance) || 0), 0);
  const totalOldBalance = advanceList.reduce((acc, b) => acc + (Number(b.old_balance || b.display_total) || 0), 0);
  const totalNetAmount = advanceList.reduce((acc, b) => acc + (Number(b.net_amount) || Number(b.old_balance) || 0), 0);
  const totalRemainingToPay = advanceList.reduce((acc, b) => {
    const rem = b.remaining_to_pay !== undefined
      ? Number(b.remaining_to_pay)
      : Math.max(0, (Number(b.net_amount || b.old_balance) || 0) - (Number(b.advance) || 0));
    return acc + rem;
  }, 0);

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

          {/* Card 1: Add Advance (Single Kisan) */}
          <div style={{ flex: '1 1 340px', minWidth: '280px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#15803d', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              {editingAdvanceId ? 'Edit Advance' : 'Add Advance'}
            </div>

            <form onSubmit={handleSingleSubmit} style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
                <input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
                <button type="button" onClick={() => alert(`Date selected: ${advanceDate}`)} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Next
                </button>
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Select Kisan:</label>
                <select
                  id="single-kisan-select"
                  value={selectedKisan}
                  onChange={(e) => setSelectedKisan(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', backgroundColor: '#ffffff' }}
                >
                  <option value="">Select Kisan</option>
                  {kisanOptions.map((kisan, idx) => (
                    <option key={idx} value={kisan}>{kisan}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>Advance (₹):</label>
                <input
                  type="number"
                  value={singleAmount}
                  onChange={(e) => setSingleAmount(e.target.value)}
                  placeholder="0"
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{ flex: '1', padding: '10px', backgroundColor: editingAdvanceId ? '#eab308' : '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {editingAdvanceId ? 'Update Advance' : 'Submit Advance'}
                </button>
                {editingAdvanceId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{ padding: '10px 16px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Card 2: Add Advance (Multi) */}
          <div style={{ flex: '1 1 400px', minWidth: '300px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#15803d', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              Add Advance (Multi)
            </div>

            <form onSubmit={handleMultiSubmit} style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '60px', fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
                <input
                  type="date"
                  value={multiDate}
                  onChange={(e) => setMultiDate(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
                <button type="button" onClick={() => alert(`Multi date selected: ${multiDate}`)} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Next
                </button>
              </div>

              <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', marginBottom: '12px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  {kisanOptions.map((kisan, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kisan} -</span>
                      <input
                        type="number"
                        value={multiAdvances[kisan] ?? '0'}
                        onChange={(e) => handleMultiChange(kisan, e.target.value)}
                        placeholder="0"
                        style={{ width: '70px', border: '1px solid #cbd5e1', padding: '4px', borderRadius: '4px', fontSize: '13px' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Save Multi Advance
              </button>
            </form>
          </div>

        </div>

        <br />

        {/* Card 3: Advance Details Report Table with Action Column */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
          <h2 align="center" style={{ color: '#15803d', margin: '0 0 16px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>
            - Advance Details Report -
          </h2>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Filter Date:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px' }}
            />

            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Kisan Name:</label>
            <select
              value={filterKisan}
              onChange={(e) => setFilterKisan(e.target.value)}
              style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', minWidth: '150px' }}
            >
              <option value="">All Kisans</option>
              {kisanOptions.map((kisan, idx) => (
                <option key={idx} value={kisan}>{kisan}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => fetchAdvanceDetails(filterDate, filterKisan)}
              style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Get Advance Details
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                setFilterKisan('');
                fetchAdvanceDetails('', '');
              }}
              style={{ backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Clear Filters (Show All)
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {advanceList.length === 0 ? (
              <h3 align="center" style={{ color: '#dc2626', margin: '16px 0' }}>No Advance Given for selected filters</h3>
            ) : (
              <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '650px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>S.No.</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Kisan / Member Name</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Total Bags</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Old Balance (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Net Amount (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Advance Amount (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Remaining to Pay (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Date & Time</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Payment Status</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {advanceList.map((item, idx) => {
                    const netAmt = Number(item.net_amount ?? item.old_balance ?? 0);
                    const remAmt = item.remaining_to_pay !== undefined
                      ? Number(item.remaining_to_pay)
                      : Math.max(0, netAmt - (Number(item.advance) || 0));
                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px' }}>{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{item.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.no_of_bags}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#334155', fontWeight: 'bold' }}>
                          ₹{Number(item.old_balance || item.display_total || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#1e40af', fontWeight: 'bold' }}>
                          ₹{netAmt.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626', fontWeight: 'bold' }}>
                          ₹{Number(item.advance || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: remAmt > 0 ? '#d97706' : '#16a34a', fontWeight: 'bold' }}>
                          ₹{remAmt.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.date || filterDate} {item.time || item.advanceTime || ''}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: item.paid === 'YES' ? '#16a34a' : '#dc2626' }}>
                          {item.paid || 'NO'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleEditAdvance(item)}
                              style={{ backgroundColor: '#eab308', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                    <td colSpan="3" align="right" style={{ padding: '10px' }}>Totals:</td>
                    <td align="right" style={{ padding: '10px', color: '#334155' }}>
                      ₹{totalOldBalance.toLocaleString()}
                    </td>
                    <td align="right" style={{ padding: '10px', color: '#1e40af' }}>
                      ₹{totalNetAmount.toLocaleString()}
                    </td>
                    <td align="right" style={{ padding: '10px', color: '#dc2626', fontSize: '1.1rem' }}>
                      ₹{totalAdvanceAmount.toLocaleString()}
                    </td>
                    <td align="right" style={{ padding: '10px', color: '#d97706', fontSize: '1.1rem' }}>
                      ₹{totalRemainingToPay.toLocaleString()}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {confirmDeleteId !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: '1.25rem' }}>Confirm Delete</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#334155' }}>
              Are you sure you want to delete this advance record?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  handleDeleteAdvance(confirmDeleteId);
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
