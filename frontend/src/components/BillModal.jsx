import axios from "axios";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api/config";
import "../styles/modal.css";

function BillModal({ bill, isBuyerPage, onClose }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [recipientMobile, setRecipientMobile] = useState(
    bill?.mobile || bill?.mobileNo || bill?.phone || ""
  );

  useEffect(() => {
    const existingMobile = bill?.mobile || bill?.mobileNo || bill?.phone || "";
    if (existingMobile) {
      setRecipientMobile(existingMobile);
      return;
    }
    // Automatically fetch mobile number from kisans directory if not directly attached
    const fetchMobile = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE_URL}/api/kisans`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.data && res.data.success) {
          const kisans = res.data.kisans || [];
          const currentName = (bill?.kisanName || bill?.name || "").trim().toLowerCase();
          const match = kisans.find(k => (k.name || "").trim().toLowerCase() === currentName);
          if (match && match.mobile) {
            setRecipientMobile(match.mobile);
          }
        }
      } catch (e) {}
    };
    if (bill) {
      fetchMobile();
    }
  }, [bill]);

  if (!bill) return null;

  const isBuyerBill = bill.type === "BUYER" || Boolean(isBuyerPage);
  const isPaid = bill.paid === "YES";
  const farmerName = bill.kisanName || bill.name || (isBuyerBill ? "Buyer" : "Kisan");
  const billDate = bill.date || new Date().toISOString().split("T")[0];
  const billTime = bill.time || bill.advanceTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Total Bags Calculation
  const totalBagsCount =
    bill.channels && bill.channels.length > 0
      ? bill.channels.reduce((acc, c) => acc + (Number(c.bags) || 0), 0)
      : Number(bill.bags || bill.no_of_bags) || 0;

  // Financial Breakdown calculations
  const grossTotal = Number(bill.total || (totalBagsCount * (Number(bill.price) || 0))) || 0;
  const hamaliPerBag = bill.hamali !== undefined && Number(bill.hamali) > 0 ? Number(bill.hamali) : 5;
  const hamaliVal = hamaliPerBag * totalBagsCount;
  const commissionVal =
    bill.commission !== undefined
      ? Number(bill.commission)
      : Math.round(grossTotal * 0.04);
  const damagedGoodsVal =
    bill.damagedGoods !== undefined && Number(bill.damagedGoods) > 0
      ? Number(bill.damagedGoods)
      : Math.round(grossTotal * 0.06);
  const advanceVal = Number(bill.advance) || 0;

  const totalExpenses = commissionVal + hamaliVal + damagedGoodsVal + advanceVal;
  const computedUnsettledNet = isBuyerBill
    ? Math.max(0, grossTotal - advanceVal)
    : Math.max(0, grossTotal - totalExpenses);

  // When paid is YES, net payable MUST be ZERO (0)!
  const netPayable = isPaid ? 0 : computedUnsettledNet;
  const settledAmount = isPaid ? (Number(bill.paid_amount) || computedUnsettledNet) : 0;
  const paymentDate = bill.paid_date || (isPaid ? `${billDate} ${billTime}` : null);

  // PDF Export Feature
  const handleDownloadPDF = async () => {
    const element = document.getElementById("thermal-slip-view") || document.getElementById("printable-bill");
    if (!element) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

      const filename = `Invoice_Agri_${farmerName}_${bill.id || "101"}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("Error generating PDF invoice:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Isolated Thermal Receipt Print Handler
  const handlePrint = () => {
    const slipElement = document.getElementById("thermal-slip-view");
    if (!slipElement) {
      window.print();
      return;
    }

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title></title>
          <style>
            @page {
              size: auto;
              margin: 5mm;
            }
            body {
              margin: 0;
              padding: 10px;
              font-family: monospace;
              background-color: #ffffff;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #thermal-slip-view {
              border: 1px dashed #64748b !important;
              padding: 16px !important;
              background-color: #ffffff !important;
              border-radius: 8px !important;
              font-family: monospace !important;
              width: 340px !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              color: #000000 !important;
            }
          </style>
        </head>
        <body>
          <div id="thermal-slip-view">
            ${slipElement.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() {
                if (window.frameElement) {
                  window.frameElement.remove();
                }
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    frameDoc.close();
  };

  // Smart SMS / Messaging dispatch
  const dispatchSMS = async (text, label) => {
    const cleanMobile = recipientMobile ? recipientMobile.replace(/\D/g, "") : "";

    if (!cleanMobile || cleanMobile.length < 10) {
      setStatusMessage("⚠️ Please enter a valid 10-digit mobile number!");
      const inputEl = document.getElementById("recipient-mobile-input");
      if (inputEl) {
        inputEl.focus();
        inputEl.style.borderColor = "#dc2626";
        inputEl.style.boxShadow = "0 0 0 3px rgba(220, 38, 38, 0.2)";
      }
      setTimeout(() => {
        setStatusMessage("");
        if (inputEl) {
          inputEl.style.borderColor = "#cbd5e1";
          inputEl.style.boxShadow = "none";
        }
      }, 4000);
      return;
    }

    setIsSendingSMS(true);
    try {
      navigator.clipboard.writeText(text);

      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/api/send-sms`,
        {
          mobile: cleanMobile,
          message: text,
          bill_id: bill?.id,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobileDevice) {
        setStatusMessage(`✓ ${label} opening in SMS app for +91 ${cleanMobile}!`);
        window.open(`sms:${cleanMobile}?body=${encodeURIComponent(text)}`, "_self");
      } else {
        setStatusMessage(`✓ ${label} copied to clipboard! Opening WhatsApp Web for +91 ${cleanMobile}...`);
        const waUrl = `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, "_blank");
      }
    } catch (err) {
      setStatusMessage(`✓ ${label} copied to clipboard for +91 ${cleanMobile}!`);
    } finally {
      setIsSendingSMS(false);
      setTimeout(() => setStatusMessage(""), 6000);
    }
  };

  // SMS Generation per channel
  const handleSendChannelSMS = (ch, idx) => {
    const text = `Agri Commission Manager: Hi ${farmerName}, Lot #${idx + 1}: ${ch.bags} Bags @ Rs.${ch.price}/bag = Total Rs.${ch.bags * ch.price} [Date: ${ch.date || billDate} ${billTime}].`;
    dispatchSMS(text, `Lot #${idx + 1} Message`);
  };

  // SMS Generation for Full Invoice
  const handleSendFullSMS = () => {
    let channelBreakdown = "";
    if (bill.channels && bill.channels.length > 0) {
      channelBreakdown = bill.channels
        .map((ch, idx) => `Lot ${idx + 1}: ${ch.bags} Bags @ Rs.${ch.price}`)
        .join("\n");
    } else {
      channelBreakdown = `Bags: ${totalBagsCount} @ Rs.${bill.price || 0}`;
    }

    const paymentLine = isPaid
      ? `\nPaid & Settled: Rs.${settledAmount} on ${paymentDate || billDate}\nBalance Due: Rs.0 (PAID IN FULL)`
      : `\nNet Payable: Rs.${netPayable}`;

    const text = `Agri Commission Manager Invoice #${bill.id || 101}\nDate & Time: ${billDate} ${billTime}\nFarmer: ${farmerName}\n${channelBreakdown}\nGross: Rs.${grossTotal}\nCommission (4%): -Rs.${commissionVal}\nDamage (6%): -Rs.${damagedGoodsVal}\nAdvance Paid: -Rs.${advanceVal}${paymentLine}\nThank you!`;
    dispatchSMS(text, "Full Invoice Message");
  };

  // WhatsApp Direct Share
  const handleSendWhatsApp = () => {
    const cleanMobile = recipientMobile ? recipientMobile.replace(/\D/g, "") : "";

    if (!cleanMobile || cleanMobile.length < 10) {
      setStatusMessage("⚠️ Please enter a valid 10-digit mobile number to send WhatsApp message!");
      const inputEl = document.getElementById("recipient-mobile-input");
      if (inputEl) {
        inputEl.focus();
        inputEl.style.borderColor = "#dc2626";
        inputEl.style.boxShadow = "0 0 0 3px rgba(220, 38, 38, 0.2)";
      }
      setTimeout(() => {
        setStatusMessage("");
        if (inputEl) {
          inputEl.style.borderColor = "#cbd5e1";
          inputEl.style.boxShadow = "none";
        }
      }, 4000);
      return;
    }

    const paymentLine = isPaid
      ? `\n*Paid & Settled:* Rs.${settledAmount} on ${paymentDate || billDate}\n*Balance Due:* Rs.0 (PAID IN FULL ✓)`
      : `\n*Net Payable:* Rs.${netPayable}`;

    const text = `*Agri Commission Manager Invoice #${bill.id || 101}*\n*Date & Time:* ${billDate} ${billTime}\n*Farmer:* ${farmerName}\n*Bags:* ${totalBagsCount}\n*Gross Total:* Rs.${grossTotal}\n*Commission (4%):* -Rs.${commissionVal}\n*Damage (6%):* -Rs.${damagedGoodsVal}\n*Advance Paid:* -Rs.${advanceVal}${paymentLine}`;
    const waUrl = `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
          <h2 style={{ fontSize: "1.2rem", margin: 0, color: "#166534" }}>📄 Invoice Receipt - Agri Commission Manager</h2>
          <button className="close-btn" onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}>
            ×
          </button>
        </div>

        {statusMessage && (
          <div
            className="badge margin-bottom no-print"
            style={{
              display: "block",
              textAlign: "center",
              margin: "10px 0",
              backgroundColor: statusMessage.includes("⚠️") ? "#fef2f2" : "#dcfce7",
              color: statusMessage.includes("⚠️") ? "#dc2626" : "#15803d",
              border: statusMessage.includes("⚠️") ? "1px solid #fca5a5" : "1px solid #86efac",
              padding: "8px",
              borderRadius: "6px",
              fontWeight: "bold"
            }}
          >
            {statusMessage}
          </div>
        )}

        {/* Printable Bill Area */}
        <div className="bill-receipt-body" id="printable-bill" style={{ padding: "16px", backgroundColor: "#ffffff" }}>
          <div className="receipt-header no-print" style={{ textAlign: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, color: "#15803d", fontSize: "1.4rem", fontWeight: "bold" }}>AGRI COMMISSION MANAGER</h3>
            <p className="receipt-sub" style={{ margin: "4px 0", fontSize: "0.88rem", color: "#475569" }}>
              AGRICULTURAL COMMISSION BILL & RECEIPT
            </p>
          </div>

          <hr className="divider-line no-print" style={{ border: "none", borderTop: "1px solid #cbd5e1", margin: "12px 0" }} />

          {/* Receipt Metadata Section with Date & Time */}
          <div className="receipt-meta no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.9rem", marginBottom: "12px" }}>
            <div>
              <span>Receipt No:</span> <strong>#AGRI-{bill.id || 101}</strong>
            </div>
            <div>
              <span>Date & Time:</span> <strong style={{ color: "#1e293b" }}>{billDate} {billTime}</strong>
            </div>
            <div>
              <span>{isBuyerBill ? "Farmer / Buyer name:" : "Farmer / Kisan:"}</span> <strong>{farmerName}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <span>Mobile No:</span>
              <input
                id="recipient-mobile-input"
                type="text"
                placeholder="Mobile No."
                value={recipientMobile}
                onChange={(e) => setRecipientMobile(e.target.value)}
                style={{
                  padding: "4px 8px",
                  fontSize: "0.88rem",
                  borderRadius: "4px",
                  border: recipientMobile ? "1px solid #16a34a" : "1px solid #cbd5e1",
                  backgroundColor: recipientMobile ? "#f0fdf4" : "#ffffff",
                  width: "140px",
                  marginLeft: "4px",
                  fontWeight: "bold",
                  outline: "none"
                }}
              />
              {recipientMobile && (
                <span style={{ fontSize: "0.72rem", color: "#15803d", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                  ✓ Auto-fetched
                </span>
              )}
            </div>
          </div>

          {/* Lots Breakdown Table */}
          <table className="data-table receipt-table margin-top no-print" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", margin: "12px 0" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", color: "#1e293b" }}>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Lot / Description</th>
                {isBuyerBill && <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Kisan Name</th>}
                <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Bags</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Price / Bag</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Date & Time</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Total (₹)</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Send Message</th>
              </tr>
            </thead>
            <tbody>
              {bill.channels && bill.channels.length > 0 ? (
                bill.channels.map((ch, idx) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Lot #{idx + 1}</td>
                    {isBuyerBill && <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>{ch.kisanName || ch.kisan_name || ch.kisan || ch.farmerName || "-"}</td>}
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>{ch.bags}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>₹{ch.price}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>{ch.date || billDate} {billTime}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "right" }}>₹{(ch.bags * ch.price).toLocaleString()}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>
                      <button
                        type="button"
                        className="small-action-btn"
                        onClick={() => handleSendChannelSMS(ch, idx)}
                        style={{ padding: "4px 8px", fontSize: "0.75rem", cursor: "pointer", borderRadius: "4px", border: "1px solid #16a34a", backgroundColor: "#f0fdf4", color: "#15803d", fontWeight: "bold" }}
                      >
                        📱 Send SMS / WhatsApp
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Bags Lot</td>
                  {isBuyerBill && <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>{bill.kisanName || farmerName || "-"}</td>}
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>{totalBagsCount}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>₹{bill.price || (totalBagsCount > 0 ? grossTotal / totalBagsCount : 0)}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>{billDate} {billTime}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "right" }}>₹{grossTotal.toLocaleString()}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>
                    <button
                      type="button"
                      className="small-action-btn"
                      onClick={() =>
                        handleSendChannelSMS(
                          {
                            bags: totalBagsCount,
                            price: bill.price || grossTotal,
                            date: billDate,
                          },
                          0
                        )
                      }
                      style={{ padding: "4px 8px", fontSize: "0.75rem", cursor: "pointer", borderRadius: "4px", border: "1px solid #16a34a", backgroundColor: "#f0fdf4", color: "#15803d", fontWeight: "bold" }}
                    >
                      📱 Send SMS / WhatsApp
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Summary Breakdown with Commission (4%) and Damage (5%) */}
          <div className="receipt-summary margin-top no-print" style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", marginTop: "12px", borderTop: "1px dashed #cbd5e1", paddingTop: "8px" }}>
            <div className="summary-row highlight-total" style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
              <span>Total Bags:</span>
              <strong>{totalBagsCount} Bags</strong>
            </div>

            <div className="summary-row margin-top" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Gross Total:</span>
              <strong>₹{grossTotal.toLocaleString()}</strong>
            </div>

            {!isBuyerBill && (
              <>
                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                  <span>Hamali Deduction:</span>
                  <span>- ₹{hamaliVal.toLocaleString()}</span>
                </div>

                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                  <span>Commission (4%):</span>
                  <span>- ₹{commissionVal.toLocaleString()}</span>
                </div>

                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                  <span>Damage (6%):</span>
                  <span>- ₹{damagedGoodsVal.toLocaleString()}</span>
                </div>
              </>
            )}

            {advanceVal > 0 && (
              <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                <span>Advance Paid ({billDate} {billTime}{bill.paymentMode || bill.village ? ` - ${bill.paymentMode || bill.village}` : ''}):</span>
                <span>- ₹{advanceVal.toLocaleString()}</span>
              </div>
            )}

            {isPaid && (
              <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#15803d", fontWeight: "bold", backgroundColor: "#f0fdf4", padding: "4px 8px", borderRadius: "4px" }}>
                <span>Amount Paid & Settled ({paymentDate || 'Paid'}):</span>
                <span>- ₹{settledAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="summary-row highlight-net" style={{ display: "flex", justifyContent: "space-between", fontSize: "1.05rem", fontWeight: "bold", borderTop: "2px solid #1e293b", paddingTop: "6px", marginTop: "6px", color: isPaid ? "#15803d" : "#166534" }}>
              <span>Net Payable Amount:</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {isPaid && (
                  <span style={{ fontSize: "0.75rem", backgroundColor: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "4px", border: "1px solid #86efac", fontWeight: "bold" }}>
                    ✓ PAID IN FULL
                  </span>
                )}
                <strong>₹{netPayable.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Payment & Transaction History Card */}
          <div className="no-print" style={{
            marginTop: "16px",
            backgroundColor: isPaid ? "#f0fdf4" : "#fefce8",
            border: isPaid ? "1px solid #86efac" : "1px solid #fef08a",
            borderRadius: "8px",
            padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ fontWeight: "bold", fontSize: "0.95rem", color: isPaid ? "#166534" : "#854d0e", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>💳 Payment & Settlement History</span>
              </div>
              <span style={{
                backgroundColor: isPaid ? "#16a34a" : "#ca8a04",
                color: "#ffffff",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.78rem",
                fontWeight: "bold",
                letterSpacing: "0.5px"
              }}>
                {isPaid ? "✓ PAID IN FULL" : "⏳ UNPAID / PENDING"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "0.85rem" }}>
              <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Bill Created</span>
                <strong style={{ color: "#1e293b" }}>{billDate} {billTime}</strong>
              </div>

              <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block" }}>Advance Received</span>
                <strong style={{ color: advanceVal > 0 ? "#16a34a" : "#64748b" }}>
                  {advanceVal > 0 ? `₹${advanceVal.toLocaleString()} (${billDate} ${billTime})` : "₹0 (No Advance)"}
                </strong>
              </div>

              {isPaid ? (
                <>
                  <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #86efac" }}>
                    <span style={{ color: "#166534", fontSize: "0.75rem", display: "block", fontWeight: "bold" }}>Date & Time Paid</span>
                    <strong style={{ color: "#15803d" }}>{paymentDate || "Marked as Paid"}</strong>
                  </div>

                  <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #86efac" }}>
                    <span style={{ color: "#166534", fontSize: "0.75rem", display: "block", fontWeight: "bold" }}>Amount Paid at Settlement</span>
                    <strong style={{ color: "#15803d", fontSize: "1rem" }}>₹{settledAmount.toLocaleString()}</strong>
                  </div>

                  <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #86efac" }}>
                    <span style={{ color: "#166534", fontSize: "0.75rem", display: "block", fontWeight: "bold" }}>Total Amount Collected</span>
                    <strong style={{ color: "#15803d" }}>₹{(advanceVal + settledAmount).toLocaleString()}</strong>
                  </div>

                  <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #86efac" }}>
                    <span style={{ color: "#166534", fontSize: "0.75rem", display: "block", fontWeight: "bold" }}>Current Outstanding Due</span>
                    <strong style={{ color: "#16a34a", fontSize: "1rem" }}>₹0 (Cleared ✓)</strong>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #fecaca" }}>
                    <span style={{ color: "#b91c1c", fontSize: "0.75rem", display: "block", fontWeight: "bold" }}>Outstanding Balance</span>
                    <strong style={{ color: "#dc2626", fontSize: "1rem" }}>₹{computedUnsettledNet.toLocaleString()}</strong>
                  </div>

                  <div style={{ backgroundColor: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                    <span style={{ color: "#c2410c", fontSize: "0.75rem", display: "block", fontWeight: "bold" }}>Payment Status</span>
                    <strong style={{ color: "#ea580c" }}>Yet to Collect</strong>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Physical Paper Thermal Receipt View matching exact physical slip format from photo */}
          <div id="thermal-slip-view" style={{ marginTop: "20px", border: "1px dashed #64748b", padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", fontFamily: "monospace", maxWidth: "340px", margin: "20px auto 0 auto", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ textAlign: "left", marginBottom: "8px" }}>
              <div style={{ fontWeight: "bold", fontSize: "14px" }}>NAME : {farmerName.toUpperCase()}</div>
              {recipientMobile && (
                <div style={{ fontSize: "12px", color: "#334155", marginTop: "2px" }}>MOBILE : {recipientMobile}</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "4px" }}>
                <span>DATE : {billDate}</span>
                <span>No. {bill.id || '55113'}</span>
              </div>
            </div>
            <div style={{ borderTop: "1px dashed #334155", margin: "8px 0" }}></div>

            <div style={{ display: "grid", gridTemplateColumns: isBuyerBill ? "1.2fr 0.6fr 1fr 1fr" : "1fr 1fr 1fr", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
              {isBuyerBill && <span>KISAN</span>}
              <span style={{ textAlign: isBuyerBill ? "center" : "left" }}>QTY</span>
              <span style={{ textAlign: "center" }}>PRICE</span>
              <span style={{ textAlign: "right" }}>AMT</span>
            </div>
            <div style={{ borderTop: "1px dashed #94a3b8", marginBottom: "6px" }}></div>

            {bill.channels && bill.channels.length > 0 ? (
              bill.channels.map((ch, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: isBuyerBill ? "1.2fr 0.6fr 1fr 1fr" : "1fr 1fr 1fr", fontSize: "13px", marginBottom: "4px" }}>
                  {isBuyerBill && (
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ch.kisanName || ch.kisan_name || ch.kisan || ch.farmerName || farmerName || "-"}
                    </span>
                  )}
                  <span style={{ textAlign: isBuyerBill ? "center" : "left" }}>{ch.bags}</span>
                  <span style={{ textAlign: "center" }}>{ch.price}</span>
                  <span style={{ textAlign: "right" }}>{ch.bags * ch.price}</span>
                </div>
              ))
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isBuyerBill ? "1.2fr 0.6fr 1fr 1fr" : "1fr 1fr 1fr", fontSize: "13px", marginBottom: "4px" }}>
                {isBuyerBill && (
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {bill.kisanName || farmerName || "-"}
                  </span>
                )}
                <span style={{ textAlign: isBuyerBill ? "center" : "left" }}>{totalBagsCount}</span>
                <span style={{ textAlign: "center" }}>{bill.price || (totalBagsCount > 0 ? grossTotal / totalBagsCount : 0)}</span>
                <span style={{ textAlign: "right" }}>{grossTotal}</span>
              </div>
            )}

            <div style={{ borderTop: "1px dashed #334155", margin: "8px 0" }}></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "bold" }}>
              <span>Total</span>
              <span>{totalBagsCount} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {grossTotal}</span>
            </div>
            <div style={{ borderTop: "1px dashed #334155", margin: "8px 0" }}></div>

            {!isBuyerBill && (
              <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Commission(4%)</span>
                  <span>- {commissionVal}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Hamali</span>
                  <span>- {hamaliVal}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Less For Damages</span>
                  <span>- {damagedGoodsVal}</span>
                </div>
                {advanceVal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Advance</span>
                    <span>- {advanceVal}</span>
                  </div>
                )}
                {isPaid && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                    <span>Paid ({paymentDate || 'Settled'})</span>
                    <span>- {settledAmount}</span>
                  </div>
                )}
                <div style={{ borderTop: "1px dashed #334155", margin: "6px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                  <span>Total Expenses</span>
                  <span>{isPaid ? (totalExpenses + settledAmount) : totalExpenses}</span>
                </div>
                <div style={{ borderTop: "1px dashed #334155", margin: "6px 0" }}></div>
              </div>
            )}

            {isBuyerBill && advanceVal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", margin: "4px 0" }}>
                <span>Advance Paid ({bill.paymentMode || bill.payment_mode || "CASH"})</span>
                <span>- {advanceVal}</span>
              </div>
            )}
            {isPaid && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", margin: "4px 0", fontWeight: "bold", color: "#166534" }}>
                <span>Paid ({paymentDate || 'Settled'})</span>
                <span>- {settledAmount}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: "bold", margin: "6px 0" }}>
              <span>{isBuyerBill ? "Nett Payable" : "Nett"}</span>
              <span>{netPayable}</span>
            </div>
            {isPaid && (
              <div style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold", color: "#166534", margin: "4px 0", border: "1px dashed #166534", padding: "4px", backgroundColor: "#f0fdf4" }}>
                *** STATUS: PAID IN FULL (Rs. 0 DUE) ***
              </div>
            )}
            <div style={{ borderTop: "1px dashed #334155", margin: "8px 0" }}></div>

            <div style={{ textAlign: "center", marginTop: "10px", fontSize: "12px", fontWeight: "bold", letterSpacing: "1px" }}>
              INDIAN LEMON COMPANY
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="modal-actions no-print" style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end", marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleSendWhatsApp}
            style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #16a34a", backgroundColor: "#f0fdf4", color: "#15803d", cursor: "pointer", fontWeight: "bold" }}
          >
            💬 Send via WhatsApp
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleSendFullSMS}
            disabled={isSendingSMS}
            style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #2563eb", backgroundColor: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontWeight: "bold" }}
          >
            📱 Send SMS
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            style={{ padding: "8px 14px", borderRadius: "6px", border: "none", backgroundColor: "#16a34a", color: "#ffffff", cursor: "pointer", fontWeight: "bold" }}
          >
            {isDownloading ? "⏳ Generating PDF..." : "📄 Download PDF Invoice"}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={handlePrint}
            style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", cursor: "pointer", fontWeight: "bold" }}
          >
            🖨️ Print Bill
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ef4444", color: "#ffffff", cursor: "pointer", fontWeight: "bold" }}
          >
            ❌ Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BillModal;
