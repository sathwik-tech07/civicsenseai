import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, Share2, Printer, FileBarChart, CheckCircle, Cpu, Loader2 } from 'lucide-react';
import type { Ward, Incident, DepartmentPerformance } from '../types';
import { downloadIncidentPDFReport } from '../services/pdfReportGenerator';

interface Props {
  wards: Ward[];
  incidents: Incident[];
  departments: DepartmentPerformance[];
}

export const AIReportGenerator: React.FC<Props> = ({ wards, incidents, departments }) => {
  const [activeReport, setActiveReport] = useState<string>('executive');
  const [isGenerating, setIsGenerating] = useState(false);

  const reports = [
    { id: 'executive', title: 'Executive Summary', icon: <FileText size={20} /> },
    { id: 'ward', title: 'Ward Performance Report', icon: <FileBarChart size={20} /> },
    { id: 'predictive', title: 'Predictive Analysis', icon: <Cpu size={20} /> }
  ];

  const handleExport = async (mode: 'download' | 'print' | 'share') => {
    setIsGenerating(true);
    if (incidents.length > 0) {
      await downloadIncidentPDFReport(incidents[0], mode);
    }
    setIsGenerating(false);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <FileText color="var(--violet)" size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 600 }}>AI Report Generator</h1>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>Automated insights and intelligence summaries</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => handleExport('share')}
            style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer' }}
          >
            <Share2 size={16} /> Share
          </button>
          <button
            onClick={() => handleExport('print')}
            style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer' }}
          >
            <Printer size={16} /> Print
          </button>
          <button 
            onClick={() => handleExport('download')}
            style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 180px)' }}>
        {/* Sidebar Templates */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Templates</h3>
          {reports.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setActiveReport(r.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                background: activeReport === r.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-elevated)',
                border: `1px solid ${activeReport === r.id ? 'var(--violet)' : 'var(--border)'}`,
                borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ color: activeReport === r.id ? 'var(--violet)' : 'var(--text-secondary)' }}>
                {r.icon}
              </div>
              <span style={{ fontWeight: 500 }}>{r.title}</span>
              {activeReport === r.id && <CheckCircle size={16} color="var(--violet)" style={{ marginLeft: 'auto' }} />}
            </motion.button>
          ))}
          
          <div style={{ marginTop: 'auto', padding: '1rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Data Sources</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.75rem' }}>{wards.length} Wards</span>
              <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.75rem' }}>{incidents.length} Incidents</span>
              <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.75rem' }}>Financials</span>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '2rem', color: '#1a1a1a', overflowY: 'auto', position: 'relative' }}>
          <AnimatePresence>
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
              >
                <Loader2 size={48} color="var(--violet)" style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                <p style={{ marginTop: '1rem', fontWeight: 600 }}>Synthesizing Intelligence Report...</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'serif' }}>
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold' }}>CivicSense AI</h1>
                <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.25rem', color: '#666', fontWeight: 'normal' }}>
                  {activeReport === 'executive' ? 'Executive Summary' : activeReport === 'ward' ? 'Ward Performance Report' : 'Predictive Analysis'}
                </h2>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#666' }}>
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Generated by: Core AI Engine</div>
              </div>
            </div>

            <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              This automated report provides a comprehensive overview of municipal performance, derived from real-time civic data, 
              citizen reporting, and predictive AI models. 
            </p>

            <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginTop: '2rem' }}>Key Highlights</h3>
            <ul style={{ lineHeight: 1.8 }}>
              <li><strong>Total Active Incidents:</strong> {incidents.length} across all sectors.</li>
              <li><strong>Highest Priority Ward:</strong> {[...wards].sort((a,b)=>a.overallScore - b.overallScore)[0]?.name || 'N/A'} requires immediate attention.</li>
              <li><strong>Budget Utilization:</strong> Department spending is currently optimized by AI forecasting, preventing an estimated $120k in emergency repair costs this quarter.</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginTop: '2rem' }}>Departmental Overview</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Department</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Open Incidents</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Resolved (Month)</th>
                </tr>
              </thead>
              <tbody>
                {departments.map(dept => (
                  <tr key={dept.id}>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{dept.name}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{dept.openIncidents}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{dept.resolvedThisMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ marginTop: '4rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
              CONFIDENTIAL • AI GENERATED INTELLIGENCE REPORT
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
