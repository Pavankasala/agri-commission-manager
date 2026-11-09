import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../api/config';

export default function SMS({ user, onLogout }) {
  const [sdate, setSdate] = useState(new Date().toISOString().split('T')[0]);
  const [smsList, setSmsList] = useState([]);
  const [searched, setSearched] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const generateSmsFromBills = (billsList) => {
    const companyInitials = user?.company_initials || 'I.L.C.';

    return billsList.map((bill, index) => {
      const kisanName = bill.name || bill.kisanName || 'Kisan';
      const items = (bill.channels && bill.channels.length > 0)
        ? bill.channels
        : [{ bags: bill.no_of_bags || bill.bags || 0, price: bill.price || 0 }];

      const totalBags = items.reduce((sum, item) => sum + (Number(item.bags || item.no_of_bags) || 0), 0);

      const itemLines = items.map(item => {
        const bags = item.bags || item.no_of_bags || 0;
        const price = item.price || 0;
        return `   ${bags} X ${price}`;
      }).join('\n');

      const mobileStr = bill.mobile || bill.phone || '-';
      const cleanMobile = mobileStr.replace(/[^0-9]/g, '');

      const smsText = `Hi ${kisanName}, (Total Bags: ${totalBags})\n${itemLines}\n   --- ${companyInitials}\nMobile No: ${mobileStr}`;

      return {
        id: bill.id || index + 1,
        sno: index + 1,
        kisanName: kisanName,
        mobile: mobileStr,
        cleanMobile: cleanMobile,
        smsText: smsText
      };
    });
  };

  const fetchSMSToBeSent = async () => {
    let allBills = [];
    try {
      const res = await axios.get(`${API_BASE_URL}/api/home-bills?date=${sdate}`);
      if (res.data && res.data.success) {
        allBills = (res.data.bills || []).filter(b => b.type !== 'BUYER');
      }
    } catch (err) { }

    const generated = generateSmsFromBills(allBills);
    setSmsList(generated);
    setSearched(true);
  };

  useEffect(() => {
    fetchSMSToBeSent();
  }, []);

  const handleGetSMS = (e) => {
    e.preventDefault();
    fetchSMSToBeSent();
  };

  const handleCopy = (id, text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      alert("SMS text copied!");
    }
  };

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header user={user} onLogout={onLogout} />

      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Filter Card */}
        <div style={{ maxWidth: '520px', margin: '0 auto 20px auto', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#4286f4', color: 'white', padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
            Get SMS's To Be Sent
          </div>

          <form onSubmit={handleGetSMS} style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Date:</label>
              <input
                type="date"
                value={sdate}
                onChange={(e) => setSdate(e.target.value)}
                required
                style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', flex: '1' }}
              />
              <button
                type="submit"
                style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '7px 16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Get SMS's To Be Sent
              </button>
            </div>
          </form>
        </div>

        {/* SMS List Card */}
        {searched && (
          <div style={{ maxWidth: '750px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #8ce86a' }}>
            <div style={{ overflowX: 'auto' }}>
              <table width="100%" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#15803d', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>S.No.</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>SMS Content & Mobile Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {smsList.length === 0 ? (
                    <tr>
                      <td colSpan="2" align="center" style={{ padding: '20px', color: '#dc2626', fontWeight: 'bold' }}>
                        No SMS data found for {sdate}
                      </td>
                    </tr>
                  ) : (
                    smsList.map((item, idx) => {
                      const smsUri = `sms:${item.cleanMobile || ''}?body=${encodeURIComponent(item.smsText)}`;
                      const waUri = `https://api.whatsapp.com/send?phone=${item.cleanMobile ? (item.cleanMobile.length === 10 ? '91' + item.cleanMobile : item.cleanMobile) : ''}&text=${encodeURIComponent(item.smsText)}`;

                      return (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>
                            {item.sno}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: '#0f172a', marginBottom: '10px' }}>
                              {item.smsText}
                            </div>

                            {/* Action Buttons for Mobile Testing & Delivery */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <a
                                href={smsUri}
                                style={{ backgroundColor: '#2563eb', color: 'white', textDecoration: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                📱 Send via SMS App
                              </a>

                              <a
                                href={waUri}
                                target="_blank"
                                rel="noreferrer"
                                style={{ backgroundColor: '#16a34a', color: 'white', textDecoration: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                💬 Send via WhatsApp
                              </a>

                              <button
                                type="button"
                                onClick={() => handleCopy(item.id, item.smsText)}
                                style={{ backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                {copiedId === item.id ? '✓ Copied!' : '📋 Copy Text'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
