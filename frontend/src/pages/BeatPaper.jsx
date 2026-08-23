import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function BeatPaper({ user, onLogout }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bills, setBills] = useState([]);
  const [searched, setSearched] = useState(false);

  const fetchBeatPaperBills = async (selectedDate) => {
    const d = selectedDate || date;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/home-bills?date=${d}`);
      if (res.data && res.data.success) {
        const apiBills = (res.data.bills || []).filter(b => b.type !== 'BUYER');
        setBills(apiBills);
        setSearched(true);
        return;
      }
    } catch (e) { }
    setBills([]);
    setSearched(true);
  };


  useEffect(() => {
    fetchBeatPaperBills(date);
  }, []);

  const handleGetBills = (e) => {
    e.preventDefault();
    fetchBeatPaperBills(date);
  };

  // Group bills / line items by Kisan for clean S.No rendering
  const processBillRows = () => {
    const rows = [];
    let sno = 1;

    bills.forEach((bill) => {
      const kisanName = bill.name || bill.kisanName || 'Unknown';
      const items = (bill.channels && bill.channels.length > 0)
        ? bill.channels
        : [{ bags: bill.no_of_bags || bill.bags || 0, price: bill.price || 0 }];

      items.forEach((item, itemIdx) => {
        const bags = Number(item.bags || item.no_of_bags || 0);
        const price = Number(item.price || 0);
        const total = bags * price;

        rows.push({
          sno: itemIdx === 0 ? sno : '',
          isFirstInGroup: itemIdx === 0,
          groupSize: items.length,
          kisanName: kisanName,
          bags: bags,
          price: price,
          total: total
        });
      });
      sno++;
    });

    return rows;
  };

  const processedRows = processBillRows();
  const grandTotalBags = processedRows.reduce((acc, r) => acc + r.bags, 0);
  const grandTotalAmount = processedRows.reduce((acc, r) => acc + r.total, 0);

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#ffffff', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '12px 16px' }}>
        {/* Inline Date Filter Row matching reference image */}
        <form onSubmit={handleGetBills} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={{ border: '1px solid #767676', padding: '3px 6px', borderRadius: '2px', fontSize: '14px', width: '140px' }}
          />
          <button
            type="submit"
            style={{ backgroundColor: '#efefef', color: '#000000', border: '1px solid #767676', borderRadius: '3px', padding: '3px 10px', fontSize: '13px', cursor: 'pointer' }}
          >
            Get Bills
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '3px', padding: '4px 12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '6px' }}
          >
            🖨️ Print
          </button>
        </form>

        {/* Compact Left-Aligned Table (~320px width) matching reference image */}
        <div style={{ width: 'fit-content', minWidth: '300px', maxWidth: '360px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #cbd5e1', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#15803d', color: '#ffffff' }}>
                <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #15803d', fontWeight: 'bold', width: '45px' }}>S.No.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #15803d', fontWeight: 'bold' }}>Kisan Name</th>
                <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #15803d', fontWeight: 'bold', width: '70px' }}>No.of bags</th>
                <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #15803d', fontWeight: 'bold', width: '55px' }}>Price</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #15803d', fontWeight: 'bold', width: '65px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {processedRows.length === 0 ? (
                <tr>
                  <td colSpan="5" align="center" style={{ padding: '16px', color: '#dc2626', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>
                    No Bills Found for {date}
                  </td>
                </tr>
              ) : (
                processedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>
                      {row.sno}
                    </td>
                    <td style={{ padding: '5px 8px', fontWeight: 'bold', color: '#0f172a', border: '1px solid #e2e8f0' }}>
                      {row.kisanName}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                      {row.bags}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                      {row.price}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>
                      {row.total.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}

              {processedRows.length > 0 && (
                <tr style={{ backgroundColor: '#ffffff', fontWeight: 'bold', borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan="2" align="right" style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>Total</td>
                  <td align="center" style={{ padding: '6px 8px', color: '#0f172a', border: '1px solid #e2e8f0' }}>{grandTotalBags}</td>
                  <td style={{ border: '1px solid #e2e8f0' }}></td>
                  <td align="right" style={{ padding: '6px 8px', color: '#0f172a', border: '1px solid #e2e8f0' }}>
                    {grandTotalAmount.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
