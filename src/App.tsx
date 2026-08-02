import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth, type UserRole } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import { CityDigitalTwin3D } from './components/CityDigitalTwin3D';
import { DigitalTwinGISMap } from './components/DigitalTwinGISMap';
import { PredictiveMaintenancePanel } from './components/PredictiveMaintenancePanel';
import { SmartBudgetPlanner } from './components/SmartBudgetPlanner';
import { MobileReporter } from './components/MobileReporter';
import { MobileEmulatorFrame } from './components/MobileEmulatorFrame';
import { ComplaintHistory } from './components/ComplaintHistory';
import { IncidentDetailsPage } from './components/IncidentDetailsPage';
import { WardAnalytics } from './components/WardAnalytics';
import { AIReportGenerator } from './components/AIReportGenerator';
import { AIRoadmapModal } from './components/AIRoadmapModal';
import { GuidedDemoStoryModal } from './components/GuidedDemoStoryModal';
import { EmergencyEscalationBanner } from './components/EmergencyEscalationBanner';
import { EmergencyResponseSimulationModal } from './components/EmergencyResponseSimulationModal';
import { AICopilotPanel } from './components/AICopilotPanel';
import { CommissionerWarRoom } from './components/CommissionerWarRoom';
import { IncidentSkeleton } from './components/IncidentSkeleton';
import { LiveCCTVModal } from './components/LiveCCTVModal';
import { DispatchWebhookModule } from './components/DispatchWebhookModule';
import { BootSequence } from './components/BootSequence';

import { NotificationCenterModal } from './components/NotificationCenterModal';
import { LogoutConfirmationModal } from './components/LogoutConfirmationModal';
import { UserManagementPanel } from './components/UserManagementPanel';
import { IncidentProvider, useIncidents } from './context/IncidentContext';

import type { Incident, PredictiveRiskZone, IncidentStatus, Ward, DepartmentPerformance, CitizenContributor, NotificationItem } from './types';
import { 
  apiFetchIncidents, apiCreateIncident, apiUpdateIncident,
  apiFetchWards, apiFetchDepartments, apiFetchPredictiveRisks, apiFetchCitizens, apiFetchNotifications
} from './services/apiClient';
import type { AIAction } from './services/apiClient';
import confetti from 'canvas-confetti';
import { Bot, RefreshCw, LogOut } from 'lucide-react';
import './App.css';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

function MainApp() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

  // Automatically adjust default active tab based on logged-in user role
  useEffect(() => {
    if (user?.role === 'citizen') {
      setActiveTab('mobile');
    } else if (user?.role === 'engineer' || user?.role === 'commissioner' || user?.role === 'admin') {
      setActiveTab('dashboard');
    }
  }, [user?.role]);

  const handleConfirmLogout = () => {
    queryClient.clear();
    logout();
    setIsLogoutModalOpen(false);
  };
  const { data: wards = [] } = useQuery<Ward[]>({
    queryKey: ['wards'],
    queryFn: apiFetchWards,
  });

  const { data: predictiveRisks = [] } = useQuery<PredictiveRiskZone[]>({
    queryKey: ['predictiveRisks'],
    queryFn: apiFetchPredictiveRisks,
  });

  const { data: departments = [] } = useQuery<DepartmentPerformance[]>({
    queryKey: ['departments'],
    queryFn: apiFetchDepartments,
  });

  const { data: citizens = [] } = useQuery<CitizenContributor[]>({
    queryKey: ['citizens'],
    queryFn: apiFetchCitizens,
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isDemoStoryOpen, setIsDemoStoryOpen] = useState<boolean>(false);
  const [showEmergencyBanner, setShowEmergencyBanner] = useState<boolean>(true);
  const [isEmergencySimulationOpen, setIsEmergencySimulationOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [hasBooted, setHasBooted] = useState<boolean>(false);
  const [activeCCTVIncidentId, setActiveCCTVIncidentId] = useState<string | null>(null);
  const [dispatchWebhookIncidentId, setDispatchWebhookIncidentId] = useState<string | null>(null);

  // Notifications Query (Real-time 3s polling)
  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: apiFetchNotifications,
    refetchInterval: 3000,
  });

  // Global Incident Store (backed by GET /api/v1/incidents, auto-refreshed on POST /api/v1/incidents)
  const { 
    incidents, 
    isLoading: isLoadingIncidents, 
    isError: isErrorIncidents, 
    refetchIncidents, 
    createIncident, 
    updateIncident 
  } = useIncidents();

  const handleAddNewIncident = async (newIncident: Incident) => {
    await createIncident(newIncident);
  };

  const handleDispatchCrew = async (incidentId: string) => {
    await updateIncident(incidentId, { status: 'in_progress', assignedCrew: 'Rapid Response Crew Alpha-1' });
    alert(`Work order issued! Rapid Response Crew dispatched for Incident ${incidentId}. Saved to database.`);
  };

  const handleStatusChange = async (incidentId: string, newStatus: IncidentStatus) => {
    await updateIncident(incidentId, { status: newStatus });
  };

  const handleTriggerProactiveWorkOrder = (risk: PredictiveRiskZone) => {
    alert(`Proactive Work Order Approved for ${risk.zoneName}! Estimated Savings: $${risk.potentialDamageCostIfIgnored - risk.estimatedInterventionCost}`);
    confetti({ particleCount: 70, spread: 50, origin: { y: 0.6 } });
  };

  const handleEmergencySimulationComplete = async () => {
    const targetIncidentId = selectedIncidentId
      ?? incidents.find((incident) => incident.status !== 'resolved' && incident.severity === 'critical')?.id
      ?? incidents[0]?.id;

    if (!targetIncidentId) return;

    await updateIncident(targetIncidentId, { status: 'resolved' });
    const targetIncident = incidents.find(i => i.id === targetIncidentId);
    if (targetIncident) {
      queryClient.setQueryData(['wards'], (oldWards: Ward[] | undefined) => {
        if (!oldWards) return [];
        return oldWards.map(ward =>
          ward.id === targetIncident.wardId
            ? {
                ...ward,
                openComplaints: Math.max(0, ward.openComplaints - 1),
                closedComplaints: ward.closedComplaints + 1,
                overallScore: Math.min(100, ward.overallScore + 2)
              }
            : ward
        );
      });
    }
  };

  const executeAIAction = (action: AIAction) => {
    switch (action.actionType) {
      case 'NAVIGATE_TO_TAB':
        setActiveTab(action.payload);
        setIsCopilotOpen(false);
        break;
      case 'DISPATCH_CREW':
        const targetId = action.payload === 'auto' 
          ? incidents.find((incident) => incident.status !== 'resolved' && incident.severity === 'critical')?.id || incidents[0]?.id
          : action.payload;
        if (targetId) handleDispatchCrew(targetId);
        break;
      case 'RESOLVE_INCIDENT':
        if (action.payload) handleStatusChange(action.payload, 'resolved');
        break;
      case 'FLY_TO_COORDS':
        setActiveTab('3d-twin');
        break;
      default:
        console.warn('Unknown AI Action:', action);
    }
  };

  const handleRoleLogin = (role: UserRole) => {
    if (role === 'commissioner') setActiveTab('dashboard');
    else if (role === 'engineer') setActiveTab('mobile');
    else if (role === 'citizen') setActiveTab('mobile');
    else if (role === 'admin') setActiveTab('analytics');
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleRoleLogin} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      overflowX: 'hidden'
    }}>
      <AnimatePresence mode="wait">
        {!hasBooted ? (
          <BootSequence key="boot" onComplete={() => setHasBooted(true)} />
        ) : (
          <motion.div
            key="app-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Navigation Bar */}
            <Navbar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                setSelectedIncidentId(null);
                setActiveTab(tab);
              }}
              onStartDemoStory={() => setIsDemoStoryOpen(true)}
              emergencyCount={incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length}
              onOpenNotifications={() => setIsNotificationOpen(true)}
              unreadNotifCount={notifications.filter(n => !n.read).length}
              onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
            />

      <main className="app-main">
        {showEmergencyBanner && (
          <EmergencyEscalationBanner
            onDismiss={() => setShowEmergencyBanner(false)}
            onAcknowledgeAndDeploy={() => {
              setActiveTab('3d-twin');
              setIsEmergencySimulationOpen(true);
            }}
          />
        )}

        {isLoadingIncidents ? (
          <div style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 40 }}>
            <IncidentSkeleton />
            <div style={{ marginTop: 24 }}><IncidentSkeleton /></div>
          </div>
        ) : isErrorIncidents ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: '#F8FAFC' }}>
            <h2 style={{ fontSize: 24, marginBottom: 12, color: '#EF4444' }}>Backend Unavailable</h2>
            <p style={{ color: '#94A3B8', marginBottom: 24 }}>Unable to connect to the smart city backend infrastructure.</p>
            <button 
              onClick={() => refetchIncidents()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', 
                background: '#3B82F6', border: 'none', borderRadius: 8, color: '#FFF', 
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              <RefreshCw size={18} />
              Retry Connection
            </button>
          </div>
        ) : selectedIncidentId ? (
          <IncidentDetailsPage
            incidentId={selectedIncidentId}
            onBack={() => setSelectedIncidentId(null)}
            onStatusChange={handleStatusChange}
            onDispatchCrew={handleDispatchCrew}
            onOpenGISMap={() => {
              setSelectedIncidentId(null);
              setActiveTab('gis');
            }}
            onOpenComplaintHistory={() => {
              setSelectedIncidentId(null);
              setActiveTab('my-complaints');
            }}
            onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="page-transition"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
            {activeTab === 'war-room' && (
              <CommissionerWarRoom
                incidents={incidents}
                wards={wards}
                departments={departments}
                onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
                onOpenEmergencySimulation={() => setIsEmergencySimulationOpen(true)}
              />
            )}

            {activeTab === 'dashboard' && (
              <ExecutiveDashboard
                wards={wards}
                incidents={incidents}
                departments={departments}
                onSelectIncident={(inc: Incident) => setSelectedIncidentId(inc.id)}
                onOpenReportGenerator={() => setActiveTab('reports')}
                onTriggerEmergency={() => setShowEmergencyBanner(true)}
              />
            )}

            {activeTab === '3d-twin' && (
              <CityDigitalTwin3D
                incidents={incidents}
                predictiveRisks={predictiveRisks}
                wards={wards}
                onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
                onOpenCCTV={setActiveCCTVIncidentId}
                onDispatchCrew={(inc) => setDispatchWebhookIncidentId(inc.id)}
              />
            )}

            {activeTab === 'gis' && (
              <DigitalTwinGISMap
                incidents={incidents}
                predictiveRisks={predictiveRisks}
                wards={wards}
                onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
              />
            )}

            {activeTab === 'predictive' && (
              <PredictiveMaintenancePanel
                predictiveRisks={predictiveRisks}
                onTriggerProactiveWorkOrder={handleTriggerProactiveWorkOrder}
              />
            )}

            {activeTab === 'budget' && (
              <SmartBudgetPlanner
                departments={departments}
                incidents={incidents}
              />
            )}

            {activeTab === 'mobile' && (
              <MobileEmulatorFrame>
                <MobileReporter
                  onAddNewIncident={handleAddNewIncident}
                />
              </MobileEmulatorFrame>
            )}

            {activeTab === 'my-complaints' && (
              <ComplaintHistory
                incidents={incidents}
                onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
              />
            )}

            {activeTab === 'analytics' && (
              <WardAnalytics
                wards={wards}
                citizens={citizens}
              />
            )}

            {activeTab === 'reports' && (
              <AIReportGenerator
                wards={wards}
                incidents={incidents}
                departments={departments}
              />
            )}

            {activeTab === 'users' && (
              <UserManagementPanel />
            )}

            {activeTab === 'roadmap' && (
              <AIRoadmapModal />
            )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Global Floating AI Command OS Trigger Button (Hidden when viewing single incident details) */}
      {!selectedIncidentId && (
        <button
          onClick={() => setIsCopilotOpen(!isCopilotOpen)}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            zIndex: 8000,
            padding: '12px 22px',
            borderRadius: 9999,
            background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)',
            color: '#fff',
            border: 'none',
            fontWeight: 800,
            fontSize: 13,
            fontFamily: 'var(--font-heading)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(139, 92, 246, 0.4)',
          }}
        >
          <Bot size={20} />
          <span>AI Command OS</span>
        </button>
      )}

      {/* AI Copilot Side Drawer Panel */}
      <AICopilotPanel
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        incidents={incidents}
        onTriggerAction={executeAIAction}
        onFlyToLocation={() => setActiveTab('3d-twin')}
      />

      <GuidedDemoStoryModal
        isOpen={isDemoStoryOpen}
        onClose={() => setIsDemoStoryOpen(false)}
        onJumpToTab={(tab) => {
          setIsDemoStoryOpen(false);
          setActiveTab(tab);
        }}
      />

      <EmergencyResponseSimulationModal
        isOpen={isEmergencySimulationOpen}
        onClose={() => setIsEmergencySimulationOpen(false)}
        onDispatchComplete={handleEmergencySimulationComplete}
        onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
      />

      <NotificationCenterModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onSelectIncident={(id) => {
          setSelectedIncidentId(id);
          setActiveTab('dashboard');
        }}
      />

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
      />

      <LiveCCTVModal
        isOpen={!!activeCCTVIncidentId}
        incidentId={activeCCTVIncidentId || ''}
        onClose={() => setActiveCCTVIncidentId(null)}
      />

      {dispatchWebhookIncidentId && (
        <DispatchWebhookModule
          incidentId={dispatchWebhookIncidentId}
          onComplete={() => setDispatchWebhookIncidentId(null)}
        />
      )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <IncidentProvider>
        <MainApp />
      </IncidentProvider>
    </AuthProvider>
  );
}

export default App;
