import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jyduvkfgbmendzwvlzsj.supabase.co',
  'sb_publishable_ywftAJ2j8hiIsazy8PzFVA_JwELjlL0'
);

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

const SHEET_TABS = [
  { id: 'Dashboard', label: 'Dashboard', locked: true, color: '#2563eb' },
  { id: 'RM Dashboard', label: 'RM Dashboard', locked: false, color: '#15803d' },
  { id: 'O.C Dashboard', label: 'O.C Dashboard', locked: true, color: '#991b1b' },
  { id: 'RM O.C Dashboard', label: 'RM O.C Dashboard', locked: false, color: '#1d4ed8' },
  { id: 'Operator Calling Status', label: 'Operator Calling Status', locked: true, color: '#ca8a04' },
  { id: 'Mock Calling Status', label: 'Mock Calling Status', locked: true, color: '#047857' },
  { id: 'Exam Day Calling Status', label: 'Exam Day Calling Status', locked: true, color: '#7c3aed' },
  { id: 'TV Data Download', label: 'TV Data Download', locked: true, color: '#0284c7' }
];

export default function OpsPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSheetTab, setActiveSheetTab] = useState('Dashboard');
  const [callingFilter, setCallingFilter] = useState('All');
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', shift: '' });

  const [autoSync, setAutoSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const editingRowRef = useRef(editingRow);

  // Google Sheet Link Modal State
  const [showSheetLinkModal, setShowSheetLinkModal] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [sheetSyncMode, setSheetSyncMode] = useState('replace');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetSyncMsg, setSheetSyncMsg] = useState('');

  // Clear Roster Modal State
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('innoview_auth');
    if (session === 'true') {
      setIsAuthenticated(true);
    }
    setAuthChecking(false);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginUser.trim() === ADMIN_USER && loginPass.trim() === ADMIN_PASS) {
      localStorage.setItem('innoview_auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Username or Password. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('innoview_auth');
    setIsAuthenticated(false);
    setLoginUser('');
    setLoginPass('');
  };

  useEffect(() => {
    editingRowRef.current = editingRow;
  }, [editingRow]);

  const fetchRecords = async (isBackground = false) => {
    if (!isAuthenticated) return;
    if (!isBackground) setLoading(true);
    setIsSyncing(true);

    try {
      let query = supabase.from('duty_roster').select('*').range(0, 4999);
      if (callingFilter !== 'All') {
        query = query.eq('Biometric Calling Status', callingFilter);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Supabase Error:', error);
      } else {
        if (!editingRowRef.current) {
          setRecords(data || []);
        }
      }
    } catch (err) {
      console.error('Fetch err:', err);
    } finally {
      if (!isBackground) setLoading(false);
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecords(false);
    }
  }, [callingFilter, isAuthenticated]);

  useEffect(() => {
    if (!autoSync || !isAuthenticated) return;
    const interval = setInterval(() => {
      fetchRecords(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoSync, callingFilter, isAuthenticated]);

  const updateStatus = async (id, newStatus) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, 'Biometric Calling Status': newStatus } : r))
    );
    await supabase
      .from('duty_roster')
      .update({ 'Biometric Calling Status': newStatus })
      .eq('id', id);
  };

  const openEditModal = (row) => {
    setEditingRow(row);
    setEditFormData({
      name: row['Biometric Operator Name'] || '',
      phone: row['Biometric Operator Number'] || '',
      shift: row['Total Shift'] || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRow) return;

    setRecords((prev) =>
      prev.map((r) =>
        r.id === editingRow.id
          ? {
              ...r,
              'Biometric Operator Name': editFormData.name,
              'Biometric Operator Number': editFormData.phone,
              'Total Shift': editFormData.shift,
              'Biometric Calling Status': 'Replaced'
            }
          : r
      )
    );

    await supabase
      .from('duty_roster')
      .update({
        'Biometric Operator Name': editFormData.name,
        'Biometric Operator Number': editFormData.phone,
        'Total Shift': editFormData.shift,
        'Biometric Calling Status': 'Replaced'
      })
      .eq('id', editingRow.id);

    setEditingRow(null);
  };

  const handleClearRoster = async () => {
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('duty_roster')
        .delete()
        .neq('Biometric Calling Status', 'IMPOSSIBLE_STATUS_CODE_XYZ');

      if (error) throw error;
      setRecords([]);
      setShowClearModal(false);
      alert('All duty roster records cleared. Portal is now blank.');
    } catch (err) {
      alert('Failed to clear: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const cleanHeader = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

    const headerMap = {};
    rawHeaders.forEach((h, index) => {
      const ch = cleanHeader(h);
      if (ch.includes('code')) headerMap['Center Code'] = index;
      else if (ch.includes('center') || ch.includes('venue') || ch.includes('college')) headerMap['Center Name'] = index;
      else if (ch.includes('city') || ch.includes('district')) headerMap['City'] = index;
      else if (ch.includes('design') || ch.includes('role')) headerMap['Biometric Designation'] = index;
      else if (ch.includes('shift')) headerMap['Total Shift'] = index;
      else if (ch.includes('operator') || ch.includes('name')) headerMap['Biometric Operator Name'] = index;
      else if (ch.includes('phone') || ch.includes('mobile') || ch.includes('contact') || ch.includes('number')) headerMap['Biometric Operator Number'] = index;
      else if (ch.includes('status')) headerMap['Biometric Calling Status'] = index;
    });

    const parsedData = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length < 2) continue;

      const row = {
        'Center Code': headerMap['Center Code'] !== undefined ? cols[headerMap['Center Code']] : (cols[0] || ''),
        'Center Name': headerMap['Center Name'] !== undefined ? cols[headerMap['Center Name']] : (cols[1] || ''),
        'City': headerMap['City'] !== undefined ? cols[headerMap['City']] : (cols[2] || ''),
        'Biometric Designation': headerMap['Biometric Designation'] !== undefined ? cols[headerMap['Biometric Designation']] : (cols[3] || 'Bio Opr'),
        'Total Shift': headerMap['Total Shift'] !== undefined ? cols[headerMap['Total Shift']] : (cols[4] || 'S1S2'),
        'Biometric Operator Name': headerMap['Biometric Operator Name'] !== undefined ? cols[headerMap['Biometric Operator Name']] : (cols[5] || 'Unassigned'),
        'Biometric Operator Number': headerMap['Biometric Operator Number'] !== undefined ? cols[headerMap['Biometric Operator Number']] : (cols[6] || ''),
        'Biometric Calling Status': (headerMap['Biometric Calling Status'] !== undefined ? cols[headerMap['Biometric Calling Status']] : cols[7]) || 'Pending'
      };
      parsedData.push(row);
    }
    return parsedData;
  };

  // FETCH DATA DIRECTLY FROM GOOGLE SHEET LINK
  const handleSyncGoogleSheet = async (e) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) return alert('Please paste a Google Sheet link');

    setIsSyncingSheet(true);
    setSheetSyncMsg('Connecting to Google Sheet...');

    try {
      // Extract Google Sheet ID from URL
      const match = sheetUrlInput.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match || !match[1]) {
        throw new Error('Invalid Google Sheet URL. Please copy link from address bar.');
      }
      const sheetId = match[1];

      // Direct CSV export link for Google Sheets
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      setSheetSyncMsg('Downloading data directly from Google Sheet...');

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Could not read Sheet. Make sure sheet Share setting is "Anyone with link can view".');
      }

      const text = await response.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error('No rows found or headers do not match.');
      }

      setSheetSyncMsg(`Parsed ${rows.length} records. Updating Supabase database...`);

      if (sheetSyncMode === 'replace') {
        await supabase
          .from('duty_roster')
          .delete()
          .neq('Biometric Calling Status', 'IMPOSSIBLE_STATUS_CODE_XYZ');
      }

      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        setSheetSyncMsg(`Uploading records ${i + 1} to ${Math.min(i + chunkSize, rows.length)} of ${rows.length}...`);
        const { error: insertError } = await supabase.from('duty_roster').insert(chunk);
        if (insertError) throw new Error(insertError.message);
      }

      setSheetSyncMsg('Sync complete!');
      setTimeout(() => {
        setIsSyncingSheet(false);
        setShowSheetLinkModal(false);
        setSheetSyncMsg('');
        setSheetUrlInput('');
        fetchRecords(false);
        alert(`Success! ${rows.length} records imported from Google Sheet into InnoView.`);
      }, 500);

    } catch (err) {
      console.error('Sheet Sync Error:', err);
      alert('Sync Failed: ' + err.message);
      setIsSyncingSheet(false);
      setSheetSyncMsg('');
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) return alert('No records to export');
    const headers = ['Center Code', 'Center Name', 'City', 'Designation', 'Shift', 'Operator Name', 'Phone', 'Calling Status'];
    const rows = filtered.map((r) => [
      `"${r['Center Code'] || ''}"`,
      `"${(r['Center Name'] || '').replace(/"/g, '""')}"`,
      `"${r['City'] || ''}"`,
      `"${r['Biometric Designation'] || ''}"`,
      `"${r['Total Shift'] || ''}"`,
      `"${(r['Biometric Operator Name'] || '').replace(/"/g, '""')}"`,
      `"${r['Biometric Operator Number'] || ''}"`,
      `"${r['Biometric Calling Status'] || 'Pending'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `InnoView_${activeSheetTab.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const counts = {
    total: records.length,
    confirmed: records.filter((r) => r['Biometric Calling Status'] === 'Confirmed').length,
    pending: records.filter((r) => !r['Biometric Calling Status'] || r['Biometric Calling Status'] === 'Pending').length,
    replaced: records.filter((r) => r['Biometric Calling Status'] === 'Replaced').length,
    unreachable: records.filter((r) => r['Biometric Calling Status'] === 'Not Reachable').length
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (r['Center Name'] && String(r['Center Name']).toLowerCase().includes(q)) ||
      (r['Center Code'] && String(r['Center Code']).toLowerCase().includes(q)) ||
      (r['Biometric Operator Name'] && String(r['Biometric Operator Name']).toLowerCase().includes(q)) ||
      (r['Biometric Operator Number'] && String(r['Biometric Operator Number']).toLowerCase().includes(q)) ||
      (r['City'] && String(r['City']).toLowerCase().includes(q));

    let matchesTab = true;
    if (activeSheetTab === 'Dashboard' || activeSheetTab === 'Operator Calling Status') {
      matchesTab = true;
    } else if (activeSheetTab === 'RM Dashboard' || activeSheetTab === 'RM O.C Dashboard') {
      matchesTab = (r['Biometric Designation'] || '').toLowerCase().includes('rm') || (r['Biometric Designation'] || '').toLowerCase().includes('nodal');
    } else if (activeSheetTab === 'O.C Dashboard') {
      matchesTab = (r['Biometric Designation'] || '').toLowerCase().includes('oc') || (r['Biometric Designation'] || '').toLowerCase().includes('coord');
    } else if (activeSheetTab === 'Mock Calling Status') {
      matchesTab = (r['Total Shift'] || '').toLowerCase().includes('mock') || (r['Biometric Calling Status'] || '').toLowerCase().includes('mock');
    } else if (activeSheetTab === 'Exam Day Calling Status') {
      matchesTab = (r['Biometric Calling Status'] === 'Confirmed');
    }

    return matchesSearch && matchesTab;
  });

  if (authChecking) return <div style={{ background: '#f1f5f9', minHeight: '100vh' }}></div>;

  if (!isAuthenticated) {
    return (
      <div style={{
        fontFamily: 'Inter, sans-serif',
        background: '#090d16',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, textAlign: 'center', margin: '0 0 16px 0' }}>InnoView Login</h2>
          {loginError && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px', textAlign: 'center' }}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <input type="text" required placeholder="Username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '12px', boxSizing: 'border-box' }} />
            <input type="password" required placeholder="Password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '18px', boxSizing: 'border-box' }} />
            <button type="submit" style={{ width: '100%', padding: '11px', background: '#090d16', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Inter, sans-serif',
      background: '#f1f5f9',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#0f172a'
    }}>
      
      {/* 1. TOP HEADER */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 24px', flexShrink: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#090d16' }}>⚙️ InnoView</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* GOOGLE SHEET SYNC BUTTON */}
            <button
              onClick={() => setShowSheetLinkModal(true)}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                padding: '7px 15px',
                borderRadius: '7px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
              }}
            >
              🔗 Sync Google Sheet
            </button>

            <button onClick={() => setShowClearModal(true)} style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '6px 12px', borderRadius: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              🗑️ Clear Roster (Blank)
            </button>
            <button onClick={() => setAutoSync(!autoSync)} style={{ background: autoSync ? '#f0fdf4' : '#f8fafc', color: autoSync ? '#15803d' : '#64748b', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '7px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              ● {autoSync ? 'Auto-Sync: 3s' : 'Auto-Sync: OFF'}
            </button>
            <button onClick={exportCSV} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              📥 Export CSV
            </button>
            <button onClick={handleLogout} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '7px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              🔒 Logout
            </button>
          </div>
        </div>
      </header>

      {/* 2. BODY SPLIT: LEFT VERTICAL SIDEBAR + RIGHT CONTENT */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* LEFT VERTICAL CORNER TABS SIDEBAR */}
        <aside style={{
          width: '235px',
          background: '#e9eef4',
          borderRight: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflowY: 'auto',
          userSelect: 'none'
        }}>
          
          <div style={{
            padding: '12px 16px',
            fontSize: '11px',
            fontWeight: 800,
            color: '#64748b',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>SHEETS & VIEWS</span>
            <span style={{ fontSize: '14px', cursor: 'pointer' }} onClick={() => setShowSheetLinkModal(true)} title="Sync from Sheet Link">＋</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 0' }}>
            {SHEET_TABS.map((tab) => {
              const isActive = activeSheetTab === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveSheetTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    margin: '2px 8px',
                    borderRadius: '6px',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#1d4ed8' : '#334155',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    borderLeft: `4px solid ${tab.color}`,
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {tab.locked && <span style={{ fontSize: '11px', color: '#64748b' }}>🔒</span>}
                    <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {tab.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '9px', color: '#94a3b8' }}>▼</span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid #cbd5e1', fontSize: '11px', color: '#64748b' }}>
            Total Loaded: <strong>{records.length}</strong>
          </div>
        </aside>

        {/* RIGHT MAIN WORKSPACE */}
        <main style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          padding: '14px 20px 10px 20px',
          overflow: 'hidden'
        }}>
          
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px', flexShrink: 0 }}>
            <div onClick={() => setCallingFilter('All')} style={{ cursor: 'pointer', background: '#fff', padding: '10px 16px', borderRadius: '8px', border: callingFilter === 'All' ? '2px solid #2563eb' : '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700 }}>TOTAL DEPLOYED</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{counts.total}</div>
            </div>
            <div onClick={() => setCallingFilter('Confirmed')} style={{ cursor: 'pointer', background: '#fff', padding: '10px 16px', borderRadius: '8px', border: callingFilter === 'Confirmed' ? '2px solid #16a34a' : '1px solid #e2e8f0' }}>
              <div style={{ color: '#16a34a', fontSize: '11px', fontWeight: 700 }}>CONFIRMED ({counts.total ? Math.round((counts.confirmed / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a' }}>{counts.confirmed}</div>
            </div>
            <div onClick={() => setCallingFilter('Pending')} style={{ cursor: 'pointer', background: '#fff', padding: '10px 16px', borderRadius: '8px', border: callingFilter === 'Pending' ? '2px solid #ca8a04' : '1px solid #e2e8f0' }}>
              <div style={{ color: '#ca8a04', fontSize: '11px', fontWeight: 700 }}>PENDING CALLS ({counts.total ? Math.round((counts.pending / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#ca8a04' }}>{counts.pending}</div>
            </div>
            <div onClick={() => setCallingFilter('Replaced')} style={{ cursor: 'pointer', background: '#fff', padding: '10px 16px', borderRadius: '8px', border: callingFilter === 'Replaced' ? '2px solid #2563eb' : '1px solid #e2e8f0' }}>
              <div style={{ color: '#2563eb', fontSize: '11px', fontWeight: 700 }}>REPLACED ({counts.total ? Math.round((counts.replaced / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb' }}>{counts.replaced}</div>
            </div>
            <div onClick={() => setCallingFilter('Not Reachable')} style={{ cursor: 'pointer', background: '#fff', padding: '10px 16px', borderRadius: '8px', border: callingFilter === 'Not Reachable' ? '2px solid #dc2626' : '1px solid #e2e8f0' }}>
              <div style={{ color: '#dc2626', fontSize: '11px', fontWeight: 700 }}>NOT REACHABLE ({counts.total ? Math.round((counts.unreachable / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626' }}>{counts.unreachable}</div>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
            <input type="text" placeholder="Search by center, operator, phone..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
            <select value={callingFilter} onChange={(e) => setCallingFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
              <option value="All">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Not Reachable">Not Reachable</option>
              <option value="Replaced">Replaced</option>
            </select>
            <button onClick={() => fetchRecords(false)} style={{ padding: '8px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              🔄 Sync Data
            </button>
          </div>

          {/* DATA TABLE CONTAINER */}
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}>
            
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ background: '#0f172a', color: '#f8fafc', position: 'sticky', top: 0, zIndex: 20, fontSize: '11px', fontWeight: 700 }}>
                  <tr>
                    <th style={{ padding: '10px 14px', width: '85px' }}>Code</th>
                    <th style={{ padding: '10px 14px', minWidth: '280px' }}>Exam Center Details</th>
                    <th style={{ padding: '10px 14px', width: '130px' }}>City</th>
                    <th style={{ padding: '10px 14px', width: '100px' }}>Designation</th>
                    <th style={{ padding: '10px 14px', width: '75px' }}>Shift</th>
                    <th style={{ padding: '10px 14px', minWidth: '220px' }}>Operator Details</th>
                    <th style={{ padding: '10px 14px', width: '185px' }}>Calling Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '110px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>Loading records...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155' }}>
                          {records.length === 0 ? 'No Data Loaded (Portal is Blank)' : `No matching records found for ${activeSheetTab}.`}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                          Paste your Google Sheet URL to immediately load duty roster entries.
                        </div>
                        <div style={{ marginTop: '16px' }}>
                          <button
                            onClick={() => setShowSheetLinkModal(true)}
                            style={{
                              padding: '9px 18px',
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '7px',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            🔗 Paste Google Sheet Link
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, index) => {
                      const status = row['Biometric Calling Status'] || 'Pending';
                      const isConfirmed = status === 'Confirmed';
                      const isReplaced = status === 'Replaced';
                      const isUnreachable = status === 'Not Reachable';

                      return (
                        <tr key={row.id || index} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '4px' }}>
                              {row['Center Code']}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row['Center Name']}</td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>{row['City']}</td>
                          <td style={{ padding: '10px 14px' }}>{row['Biometric Designation'] || 'Bio Opr'}</td>
                          <td style={{ padding: '10px 14px' }}>{row['Total Shift'] || 'S1S2'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600 }}>{row['Biometric Operator Name'] || 'Unassigned'}</div>
                            {row['Biometric Operator Number'] && (
                              <a href={`tel:${row['Biometric Operator Number']}`} style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none' }}>
                                📞 {row['Biometric Operator Number']}
                              </a>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <select
                              value={status}
                              onChange={(e) => updateStatus(row.id, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: isConfirmed ? '1px solid #86efac' : isReplaced ? '1px solid #bfdbfe' : isUnreachable ? '1px solid #fca5a5' : '1px solid #fde047',
                                background: isConfirmed ? '#dcfce7' : isReplaced ? '#eff6ff' : isUnreachable ? '#fee2e2' : '#fef9c3',
                                color: isConfirmed ? '#15803d' : isReplaced ? '#1d4ed8' : isUnreachable ? '#b91c1c' : '#a16207'
                              }}
                            >
                              <option value="Pending">⏳ Pending</option>
                              <option value="Confirmed">✅ Confirmed</option>
                              <option value="Replaced">🔄 Replaced</option>
                              <option value="Not Reachable">❌ Not Reachable</option>
                            </select>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button onClick={() => openEditModal(row)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              ✏️ Reassign
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '8px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>Active Tab: <strong>{activeSheetTab}</strong> ({filtered.length} entries shown)</span>
              <span>InnoView PET Portal</span>
            </div>

          </div>

        </main>
      </div>

      {/* POPUP MODAL: PASTE GOOGLE SHEET LINK */}
      {showSheetLinkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '520px', maxWidth: '94%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#0f172a', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>🔗 Sync from Google Sheet</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Paste your spreadsheet link to load all rows into InnoView</p>
              </div>
              {!isSyncingSheet && (
                <button onClick={() => setShowSheetLinkModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              )}
            </div>

            <form onSubmit={handleSyncGoogleSheet} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>
                  Google Sheet URL / Link:
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit..."
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  💡 Tip: Make sure the Google Sheet permission is set to <strong>"Anyone with the link can view"</strong>.
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                  Sync Mode:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSheetSyncMode('replace')}
                    style={{
                      padding: '9px',
                      borderRadius: '7px',
                      border: sheetSyncMode === 'replace' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: sheetSyncMode === 'replace' ? '#eff6ff' : '#fff',
                      color: sheetSyncMode === 'replace' ? '#1d4ed8' : '#475569',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Replace Entire Roster
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetSyncMode('append')}
                    style={{
                      padding: '9px',
                      borderRadius: '7px',
                      border: sheetSyncMode === 'append' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: sheetSyncMode === 'append' ? '#eff6ff' : '#fff',
                      color: sheetSyncMode === 'append' ? '#1d4ed8' : '#475569',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ➕ Append Records
                  </button>
                </div>
              </div>

              {sheetSyncMsg && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '12px', color: '#059669', fontWeight: 600, textAlign: 'center', marginBottom: '14px' }}>
                  ⏳ {sheetSyncMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  disabled={isSyncingSheet}
                  onClick={() => setShowSheetLinkModal(false)}
                  style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#475569' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncingSheet}
                  style={{
                    padding: '8px 20px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
                  }}
                >
                  {isSyncingSheet ? 'Syncing...' : 'Fetch & Load Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM CLEAR ROSTER */}
      {showClearModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '420px', maxWidth: '92%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', border: '1px solid #fee2e2', overflow: 'hidden' }}>
            <div style={{ background: '#dc2626', padding: '16px 20px', color: '#fff' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>⚠️ Clear Entire Roster (Make Blank)?</h3>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete all <strong>{records.length} records</strong> and make the portal completely blank? You can import new records anytime using your Google Sheet link.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowClearModal(false)} disabled={isClearing} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  Cancel
                </button>
                <button onClick={handleClearRoster} disabled={isClearing} style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {isClearing ? 'Clearing...' : 'Yes, Make Blank'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REASSIGN */}
      {editingRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '420px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0' }}>Reassign Operator</h3>
            <form onSubmit={handleSaveEdit}>
              <input type="text" placeholder="Name" required value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Phone" required value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Shift" value={editFormData.shift} onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '14px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setEditingRow(null)}>Cancel</button>
                <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
