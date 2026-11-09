import React, { useState } from 'react';
import Header from '../components/Header';

export default function LocalSale({ user, onLogout }) {
  const [saledate, setSaledate] = useState(new Date().toISOString().split('T')[0]);
  const [name, setName] = useState('');
  const [bags, setBags] = useState('');
  const [advance, setAdvance] = useState('');
  const [channels, setChannels] = useState([{ kisanName: '', bags: '', price: '' }]);

  const [sdate, setSdate] = useState(new Date().toISOString().split('T')[0]);
  const [salesList, setSalesList] = useState([]);
  const [searched, setSearched] = useState(false);

  const addChannel = (e) => {
    e.preventDefault();
    if (channels.length < 10) {
      setChannels([...channels, { kisanName: '', bags: '', price: '' }]);
    } else {
      alert("Maximum channels 10 only");
    }
  };

  const handleChannelChange = (index, field, value) => {
    const updated = [...channels];
    updated[index][field] = value;
    setChannels(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number(bags) < 0 || Number(advance) < 0) {
      alert("Invalid input! Negative values are not allowed.");
      return;
    }
    for (const c of channels) {
      if (Number(c.bags) < 0 || Number(c.price) < 0) {
        alert("Invalid input! Negative values are not allowed.");
        return;
      }
    }
    alert("saved successfully");
    setName('');
    setBags('');
    setAdvance('');
    setChannels([{ kisanName: '', bags: '', price: '' }]);
  };

  const handleGetLocalSales = () => {
    setSalesList([
      { id: 1, buyerName: 'Local Retailer', fromKisan: 'Farmer Ramesh', bags: 10, price: 500, total: 5000, date: '08-08-2026', paid: 'NO' }
    ]);
    setSearched(true);
  };

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

          {/* Local Sale Form Card */}
          <div style={{ flex: '1 1 340px', minWidth: '280px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              Local Sale
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '120px', fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
                <input
                  type="date"
                  value={saledate}
                  onChange={(e) => setSaledate(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '120px', fontWeight: 'bold', fontSize: '14px' }}>Local Sale Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '120px', fontWeight: 'bold', fontSize: '14px' }}>No. of bags:</label>
                <input
                  type="number"
                  value={bags}
                  onChange={(e) => setBags(e.target.value)}
                  placeholder="Bags"
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ width: '120px', fontWeight: 'bold', fontSize: '14px' }}>Advance Given:</label>
                <input
                  type="number"
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                  placeholder="Advance"
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <a href="#addChannel" onClick={addChannel} style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 'bold', fontSize: '14px' }}>
                  + Click to add a Channel
                </a>
              </div>

              <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
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

              <button
                type="submit"
                style={{ width: '100%', padding: '10px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Submit Local Sale
              </button>
            </form>
          </div>

          {/* Local Sales Filter Card */}
          <div style={{ flex: '1 1 340px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              Local Sales By Date
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
                <input
                  type="date"
                  value={sdate}
                  onChange={(e) => setSdate(e.target.value)}
                  required
                  style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
                />
                <button
                  type="button"
                  onClick={handleGetLocalSales}
                  style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Get Local Sales
                </button>
              </div>
            </div>
          </div>

        </div>

        <br />

        {/* Bottom Table: Sales On This Day */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
          <h2 align="center" style={{ color: '#15803d', margin: '0 0 16px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>
            - Sales On This Day ({sdate}) -
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table width="100%" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>S.No</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Buyer Name</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>From Kisan</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Bags</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Price</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Date</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Paid</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {salesList.length === 0 ? (
                  <tr><td colSpan="9" align="center" style={{ padding: '16px', color: '#dc2626', fontWeight: 'bold' }}>No Local Sales Found</td></tr>
                ) : (
                  salesList.map((s, idx) => (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>{idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{s.buyerName}</td>
                      <td style={{ padding: '8px' }}>{s.fromKisan}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{s.bags}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>₹{s.price}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(s.total).toFixed(2)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{s.date}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: s.paid === 'YES' ? '#16a34a' : '#dc2626' }}>{s.paid}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => alert("Delete local sale")}
                          style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
