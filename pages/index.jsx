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
  { id: 'RM Dashboard', label: 'RM Dashboard', locked: false, color: '#10b981' },
  { id: 'O.C Dashboard', label: 'O.C Dashboard', locked: true, color: '#ef4444' },
  { id: 'RM O.C Dashboard', label: 'RM O.C Dashboard', locked: false, color: '#6366f1' },
  { id: 'Operator Calling Status', label: 'Operator Calling Status', locked: true, color: '#d97706' },
  { id: 'Mock Calling Status', label: 'Mock Calling Status', locked: true, color: '#0d9488' },
  { id: 'Exam Day Calling Status', label: 'Exam Day Calling Status', locked: true, color: '#7c3aed' },
  { id: 'TV Data Download', label: 'TV Data Download', locked: true, color: '#0284c7' }
];

// SVG Lock Icon (Clean Corporate)
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  );
}

// SVG Dropdown Arrow
function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

// Original InnoView Brand Logo (Gear + Inner Curve)
function InnoViewLogo() {
  return (
    <div style={{
      width: '38px',
      height: '38px',
      borderRadius: '9px',
      background: '#090d16',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
      flexShrink: 0
    }}>
      <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M44 8h12l2.2 9.5a36 36 0 0 1 10.3 4.3L77 15l8.5 8.5-6.8 8.5a36 36 0 0 1 4.3 10.3L92 44.5v12l-9.5 2.2a36 36 0 0 1-4.3 10.3L85 77.5l-8.5 8.5-8.5-6.8a36 36 0 0 1-10.3 4.3L55.5 93h-12l-2.2-9.5a36 36 0 0 1-10.3-4.3L22.5 86 14 77.5l6.8-8.5a36 36 0 0 1-4.3-10.3L7 56.5v-12l9.5-2.2a36 36 0 0 1 4.3-10.3L14 23.5l8.5-8.5 8.5 6.8a36 36 0 0 1 10.3-4.3L44 8z" fill="#ffffff"/>
        <circle cx="50" cy="50" r="28" fill="#090d16" />
        <path d="M 68 36 A 23 23 0 0 1 36 74" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

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

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState('replace');
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

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
      setLoginError('Invalid Administrator credentials.');
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
      console.error('Fetch Error:', err);
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
      alert('Duty roster cleared successfully.');
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Reading CSV data...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSV(text);

        if (rows.length === 0) {
          alert('No valid records found in CSV.');
          setIsUploading(false);
          return;
        }

        if (uploadMode === 'replace') {
          await supabase
            .from('duty_roster')
            .delete()
            .neq('Biometric Calling Status', 'IMPOSSIBLE_STATUS_CODE_XYZ');
        }

        const chunkSize = 200;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error: insertError } = await supabase.from('duty_roster').insert(chunk);
          if (insertError) throw new Error(insertError.message);
        }

        setIsUploading(false);
        setShowUploadModal(false);
        fetchRecords(false);
        alert(`Success! Updated ${rows.length} records.`);
      } catch (err) {
        alert('Upload Error: ' + err.message);
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  if (authChecking) {
    return <div style={{ background: '#090d16', minHeight: '100vh' }}></div>;
  }

  // SIGN IN
  if (!isAuthenticated) {
    return (
      <div style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#090d16',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '380px',
          padding: '36px 32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '22px' }}>
            <InnoViewLogo />
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#090d16', letterSpacing: '-0.6px' }}>
              InnoView
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 20px 0' }}>
            Operations Command Portal Authentication
          </p>

          {loginError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', color: '#b91c1c', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>ADMIN ID</label>
              <input type="text" required placeholder="admin" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>PASSWORD</label>
              <input type="password" required placeholder="admin123" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '11px', background: '#090d16', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f8fafc',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#0f172a'
    }}>
      
      {/* 1. TOP HEADER (CLEAN CLASSIC CORPORATE) */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '10px 24px',
        flexShrink: 0,
        zIndex: 30
      }}>
        <div style={{ maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
            <InnoViewLogo />
            <div>
              <span style={{ fontSize: '22px', fontWeight: '900', color: '#090d16', letterSpacing: '-0.6px' }}>
                InnoView
              </span>
              <span style={{ marginLeft: '8px', fontSize: '10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                Operations
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '7px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Update Roster (CSV)
            </button>

            <button
              onClick={() => setShowClearModal(true)}
              style={{
                background: '#fff1f2',
                color: '#e11d48',
                border: '1px solid #fecdd3',
                padding: '7px 12px',
                borderRadius: '7px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Clear List
            </button>

            <button
              onClick={() => setAutoSync(!autoSync)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: autoSync ? '#f0fdf4' : '#f8fafc',
                borderRadius: '7px',
                fontSize: '12px',
                color: autoSync ? '#15803d' : '#64748b',
                border: autoSync ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                padding: '6px 12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: autoSync ? '#16a34a' : '#94a3b8' }}></span>
              {autoSync ? 'Auto-Sync: 3s' : 'Auto-Sync: OFF'}
            </button>

            <button
              onClick={exportCSV}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '7px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Export CSV
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '7px 12px',
                borderRadius: '7px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* 2. BODY SPLIT: LEFT SIDEBAR + RIGHT WORKSPACE */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* LEFT VERTICAL CORNER NAVIGATION */}
        <aside style={{
          width: '235px',
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
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
            borderBottom: '1px solid #e2e8f0'
          }}>
            Sheets & Dashboards
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 8px', gap: '2px' }}>
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
                    padding: '9px 12px',
                    borderRadius: '7px',
                    background: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#1d4ed8' : '#334155',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    borderLeft: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {tab.locked && <LockIcon />}
                    <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {tab.label}
                    </span>
                  </div>
                  <ChevronDown />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
            Current View: <strong>{activeSheetTab}</strong>
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '12px',
            flexShrink: 0
          }}>
            <div onClick={() => setCallingFilter('All')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: callingFilter === 'All' ? '2px solid #2563eb' : '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700 }}>TOTAL DEPLOYED</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>{counts.total}</div>
            </div>
            <div onClick={() => setCallingFilter('Confirmed')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: callingFilter === 'Confirmed' ? '2px solid #16a34a' : '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#16a34a', fontSize: '11px', fontWeight: 700 }}>CONFIRMED ({counts.total ? Math.round((counts.confirmed / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#16a34a', marginTop: '3px' }}>{counts.confirmed}</div>
            </div>
            <div onClick={() => setCallingFilter('Pending')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: callingFilter === 'Pending' ? '2px solid #ca8a04' : '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#ca8a04', fontSize: '11px', fontWeight: 700 }}>PENDING CALLS ({counts.total ? Math.round((counts.pending / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#ca8a04', marginTop: '3px' }}>{counts.pending}</div>
            </div>
            <div onClick={() => setCallingFilter('Replaced')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: callingFilter === 'Replaced' ? '2px solid #2563eb' : '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#2563eb', fontSize: '11px', fontWeight: 700 }}>REPLACED ({counts.total ? Math.round((counts.replaced / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#2563eb', marginTop: '3px' }}>{counts.replaced}</div>
            </div>
            <div onClick={() => setCallingFilter('Not Reachable')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: callingFilter === 'Not Reachable' ? '2px solid #dc2626' : '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#dc2626', fontSize: '11px', fontWeight: 700 }}>NOT REACHABLE ({counts.total ? Math.round((counts.unreachable / counts.total) * 100) : 0}%)</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626', marginTop: '3px' }}>{counts.unreachable}</div>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{
            background: '#ffffff',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '10px',
            flexShrink: 0
          }}>
            <input
              type="text"
              placeholder="Search by center code, center name, city, operator name or mobile number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
            <select
              value={callingFilter}
              onChange={(e) => setCallingFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, color: '#334155' }}
            >
              <option value="All">Filter: All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Not Reachable">Not Reachable</option>
              <option value="Replaced">Replaced</option>
            </select>
            <button
              onClick={() => fetchRecords(false)}
              style={{ padding: '8px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#334155' }}
            >
              Sync Data
            </button>
          </div>

          {/* Table Container */}
          <div style={{
            background: '#ffffff',
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
                <thead style={{
                  background: '#090d16',
                  color: '#f8fafc',
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase'
                }}>
                  <tr>
                    <th style={{ padding: '12px 14px', width: '85px' }}>Code</th>
                    <th style={{ padding: '12px 14px', minWidth: '280px' }}>Exam Center Details</th>
                    <th style={{ padding: '12px 14px', width: '130px' }}>City</th>
                    <th style={{ padding: '12px 14px', width: '100px' }}>Role</th>
                    <th style={{ padding: '12px 14px', width: '75px' }}>Shift</th>
                    <th style={{ padding: '12px 14px', minWidth: '220px' }}>Operator Details</th>
                    <th style={{ padding: '12px 14px', width: '185px' }}>Calling Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '110px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                        Loading records...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                        No records found for tab: <strong>{activeSheetTab}</strong>
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
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid #dbeafe' }}>
                              {row['Center Code']}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e293b' }}>{row['Center Name']}</td>
                          <td style={{ padding: '11px 14px', color: '#475569', fontWeight: 500 }}>{row['City']}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              {row['Biometric Designation'] || 'Bio Opr'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                              {row['Total Shift'] || 'S1S2'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#090d16' }}>{row['Biometric Operator Name'] || 'Unassigned'}</div>
                            {row['Biometric Operator Number'] && (
                              <a href={`tel:${row['Biometric Operator Number']}`} style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                                {row['Biometric Operator Number']}
                              </a>
                            )}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <select
                              value={status}
                              onChange={(e) => updateStatus(row.id, e.target.value)}
                              style={{
                                width: '100%',
                                minWidth: '155px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none',
                                boxSizing: 'border-box',
                                border: isConfirmed ? '1px solid #86efac' : isReplaced ? '1px solid #bfdbfe' : isUnreachable ? '1px solid #fca5a5' : '1px solid #fde047',
                                background: isConfirmed ? '#ecfdf5' : isReplaced ? '#eff6ff' : isUnreachable ? '#fef2f2' : '#fffbeb',
                                color: isConfirmed ? '#15803d' : isReplaced ? '#1d4ed8' : isUnreachable ? '#b91c1c' : '#a16207'
                              }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Confirmed">Confirmed</option>
                              <option value="Replaced">Replaced</option>
                              <option value="Not Reachable">Not Reachable</option>
                            </select>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            <button onClick={() => openEditModal(row)} style={{ padding: '5px 11px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#334155' }}>
                              Reassign
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '10px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>Active Tab: <strong>{activeSheetTab}</strong> • Showing {filtered.length} entries</span>
              <span>InnoView Operations Roster</span>
            </div>
          </div>

        </main>
      </div>

      {/* CSV MODAL */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '480px', maxWidth: '94%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 700 }}>Import Roster CSV</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button type="button" onClick={() => setUploadMode('replace')} style={{ padding: '9px', borderRadius: '7px', border: uploadMode === 'replace' ? '2px solid #2563eb' : '1px solid #cbd5e1', background: uploadMode === 'replace' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>Replace All</button>
              <button type="button" onClick={() => setUploadMode('append')} style={{ padding: '9px', borderRadius: '7px', border: uploadMode === 'append' ? '2px solid #2563eb' : '1px solid #cbd5e1', background: uploadMode === 'append' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>Append</button>
            </div>
            <input type="file" accept=".csv" ref={fileInputRef} disabled={isUploading} onChange={handleFileUpload} style={{ fontSize: '12px', cursor: 'pointer' }} />
            {uploadStatus && <div style={{ marginTop: '12px', color: '#2563eb', fontSize: '12px', fontWeight: 600 }}>{uploadStatus}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" disabled={isUploading} onClick={() => setShowUploadModal(false)} style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR MODAL */}
      {showClearModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '400px', maxWidth: '92%', padding: '22px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#dc2626', fontWeight: 700 }}>Clear Entire Roster?</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#475569' }}>Are you sure you want to delete all {records.length} records?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowClearModal(false)} disabled={isClearing} style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleClearRoster} disabled={isClearing} style={{ padding: '7px 16px', borderRadius: '6px', background: '#dc2626', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{isClearing ? 'Deleting...' : 'Delete All'}</button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN MODAL */}
      {editingRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '420px', maxWidth: '92%', padding: '22px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontWeight: 700 }}>Reassign Center Operator</h3>
            <form onSubmit={handleSaveEdit}>
              <input type="text" placeholder="Operator Name" required value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Phone Number" required value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Shift" value={editFormData.shift} onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '16px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setEditingRow(null)} style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '7px 16px', borderRadius: '6px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
