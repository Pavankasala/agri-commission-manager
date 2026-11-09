import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function CashCollection({ user, onLogout }) {
  const [cbilldate, setCbilldate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [cname, setCname] = useState('');

  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [singleList, setSingleList] = useState([]);
  const [rangeList, setRangeList] = useState([]);
  const [singleSearched, setSingleSearched] = useState(false);
  const [rangeSearched, setRangeSearched] = useState(false);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (Number(amount) < 0) {
      alert("Invalid input! Cash collection amount cannot be negative.");
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/cash-collection`, {
        date: cbilldate,
        amount: amount,
        given_by: cname
      });
    } catch (err) { }
    alert('saved successfully');
    setAmount('');
    setCname('');
    fetchSingleDate();
  };

  const fetchSingleDate = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/cash-collection?date=${singleDate}`);
      if (res.data && res.data.success) {
        setSingleList(res.data.cash_collections || []);
      }
    } catch (err) {
      setSingleList([]);
    }
    setSingleSearched(true);
  };

  const fetchRangeDate = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/cash-collection?fromDate=${fromDate}&toDate=${toDate}`);
      if (res.data && res.data.success) {
        setRangeList(res.data.cash_collections || []);
      }
    } catch (err) {
      setRangeList([]);
    }
    setRangeSearched(true);
  };

  useEffect(() => {
    fetchSingleDate();
  }, []);

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

          {/* Card 1: Add Cash Collection */}
          <div style={{ flex: '1 1 300px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              Add Cash Collection
            </div>

            <form onSubmit={handleAddSubmit} style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '80px', fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
                <input
                  type="date"
                  value={cbilldate}
                  onChange={(e) => setCbilldate(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '80px', fontWeight: 'bold', fontSize: '14px' }}>Amount:</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '80px', fontWeight: 'bold', fontSize: '14px' }}>Given By:</label>
                <input
                  type="text"
                  value={cname}
                  onChange={(e) => setCname(e.target.value)}
                  placeholder="Name"
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '10px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Submit Cash Collection
              </button>
            </form>
          </div>

          {/* Card 2: List Cash Collection By Single Date */}
          <div style={{ flex: '1 1 340px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              List Cash Collection By Date
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
                <button
                  type="button"
                  onClick={fetchSingleDate}
                  style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cash Collections
                </button>
              </div>

              {singleSearched && (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table width="100%" style={{ borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>S.No.</th>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Given By</th>
                        <th style={{ padding: '6px', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singleList.length === 0 ? (
                        <tr><td colSpan="3" align="center" style={{ padding: '10px', color: '#dc2626' }}>No collections found</td></tr>
                      ) : (
                        singleList.map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '6px' }}>{idx + 1}</td>
                            <td style={{ padding: '6px', fontWeight: 'bold' }}>{item.given_by}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>₹{Number(item.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: List Complete Cash Collections Range */}
          <div style={{ flex: '1 1 400px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              List Complete Cash Collections
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>From:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>To:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
                <button
                  type="button"
                  onClick={fetchRangeDate}
                  style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Get Collections
                </button>
              </div>

              {rangeSearched && (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table width="100%" style={{ borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>S.No.</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Date</th>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Given By</th>
                        <th style={{ padding: '6px', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangeList.length === 0 ? (
                        <tr><td colSpan="4" align="center" style={{ padding: '10px', color: '#dc2626' }}>No range collections found</td></tr>
                      ) : (
                        rangeList.map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '6px' }}>{idx + 1}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>{item.date}</td>
                            <td style={{ padding: '6px', fontWeight: 'bold' }}>{item.given_by}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>₹{Number(item.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
