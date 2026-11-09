import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function Shops({ user, onLogout }) {
  const [billdate, setBilldate] = useState(new Date().toISOString().split('T')[0]);
  const [name, setName] = useState('');
  const [bags, setBags] = useState('');
  const [price, setPrice] = useState('');
  const [advance, setAdvance] = useState('');

  const [billdate1, setBilldate1] = useState(new Date().toISOString().split('T')[0]);
  const [shopBills, setShopBills] = useState([]);
  const [shopBillsSearched, setShopBillsSearched] = useState(false);

  const [selectedYear, setSelectedYear] = useState('2026');
  const [txtShopsName, setTxtShopsName] = useState('');
  const [searchData, setSearchData] = useState(null);

  const years = [];
  for (let y = 2017; y <= 2060; y++) {
    years.push(y);
  }

  const fetchShopBillsByDate = async (selectedDate) => {
    const targetDate = selectedDate || billdate1;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/shops?date=${targetDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.success) {
        const list = (res.data.shops || []).map(s => {
          const bagsCount = Number(s.no_of_bags || s.bags || 0);
          const priceVal = Number(s.price || 0);
          return {
            id: s.id,
            name: s.name,
            bags: bagsCount,
            price: priceVal,
            advance: Number(s.advance || 0),
            total: bagsCount * priceVal,
            date: s.date
          };
        });
        setShopBills(list);
        setShopBillsSearched(true);
      }
    } catch (err) {
      setShopBills([]);
      setShopBillsSearched(true);
    }
  };

  useEffect(() => {
    fetchShopBillsByDate(billdate1);
  }, []);

  const handleAddShopBill = async (e) => {
    e.preventDefault();
    if (Number(bags) <= 0 || Number(price) < 0 || Number(advance) < 0) {
      alert("Invalid input! Bags must be greater than zero, and Price/Advance cannot be negative.");
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/shops`, {
        name: name,
        bags: Number(bags),
        price: Number(price),
        advance: Number(advance) || 0,
        date: billdate
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.data && res.data.success) {
        alert(res.data.message || "Saved successfully!");
        setName('');
        setBags('');
        setPrice('');
        setAdvance('');
        setBilldate1(billdate);
        fetchShopBillsByDate(billdate);

      } else {
        alert(res.data?.message || "Failed to add shop bill. Please try again.");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add shop bill. Please try again.");
    }
  };

  const handleGetShopBills = () => {
    fetchShopBillsByDate(billdate1);
  };

  const handleGetShopsData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/shops?year=${selectedYear}&name=${encodeURIComponent(txtShopsName.trim())}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.success) {
        const records = (res.data.shops || []).map(r => {
          const bagsCount = Number(r.no_of_bags || r.bags || 0);
          const priceVal = Number(r.price || 0);
          const advanceVal = Number(r.advance || 0);
          const totalVal = bagsCount * priceVal;
          const pendingVal = Math.max(0, totalVal - advanceVal);
          return {
            id: r.id,
            date: r.date,
            bags: bagsCount,
            price: priceVal,
            advance: advanceVal,
            pending: pendingVal
          };
        });
        setSearchData({
          shopName: txtShopsName,
          year: selectedYear,
          records: records
        });
      }
    } catch (err) {
      setSearchData({
        shopName: txtShopsName,
        year: selectedYear,
        records: []
      });
    }
  };

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

          {/* Form Card 1: Add Bill Shop */}
          <div style={{ flex: '1 1 340px', minWidth: '280px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              Add Bill Shop
            </div>

            <form onSubmit={handleAddShopBill} style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '110px', fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
                <input type="date" value={billdate} onChange={(e) => setBilldate(e.target.value)} required style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }} />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '110px', fontWeight: 'bold', fontSize: '14px' }}>Shop Name:</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }} />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '110px', fontWeight: 'bold', fontSize: '14px' }}>No. of bags:</label>
                <input type="number" value={bags} onChange={(e) => setBags(e.target.value)} placeholder="Bags" required style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }} />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '110px', fontWeight: 'bold', fontSize: '14px' }}>Price Per Bag:</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" required style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }} />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '110px', fontWeight: 'bold', fontSize: '14px' }}>Advance Given:</label>
                <input type="number" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="Advance" style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }} />
              </div>

              <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
                Submit Shop Bill
              </button>
            </form>
          </div>

          {/* Form Card 2: List Of Shop Bills */}
          <div style={{ flex: '1 1 340px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              List Of Shop Bills
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <input type="date" value={billdate1} onChange={(e) => setBilldate1(e.target.value)} required style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }} />
                <button type="button" onClick={handleGetShopBills} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Get Shop Bills
                </button>
              </div>

              {shopBillsSearched && (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table width="100%" style={{ borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Shop</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Bags</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Price</th>
                        <th style={{ padding: '6px', textAlign: 'right' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shopBills.length === 0 ? (
                        <tr>
                          <td colSpan="4" align="center" style={{ padding: '12px', color: '#dc2626', fontWeight: 'bold' }}>
                            No shop bills found for {billdate1}
                          </td>
                        </tr>
                      ) : (
                        shopBills.map((b) => (
                          <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px', fontWeight: 'bold' }}>{b.name}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>{b.bags}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>₹{b.price}</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>₹{b.total}</td>
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

        <br />

        {/* Card 3: Search By Shop Name */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
          <h2 align="center" style={{ color: '#15803d', margin: '0 0 16px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>
            - Search By Shop Name -
          </h2>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Year:</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px' }}>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <input
              type="text"
              value={txtShopsName}
              onChange={(e) => setTxtShopsName(e.target.value)}
              placeholder="Enter Shop Name"
              style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1', minWidth: '160px' }}
            />

            <button type="button" onClick={handleGetShopsData} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}>
              Get Details
            </button>
          </div>

          {searchData && (
            <div style={{ overflowX: 'auto' }}>
              <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Bags</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Price</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Advance (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Pending (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {searchData.records.length === 0 ? (
                    <tr>
                      <td colSpan="5" align="center" style={{ padding: '12px', color: '#dc2626', fontWeight: 'bold' }}>
                        No records found for {txtShopsName || 'all shops'} in {selectedYear}
                      </td>
                    </tr>
                  ) : (
                    searchData.records.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px' }}>{r.date}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{r.bags}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>₹{r.price}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{r.advance}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>₹{r.pending}</td>
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
  );
}

