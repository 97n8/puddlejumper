import { Routes, Route } from 'react-router-dom';
import Discover     from './pages/Discover';
import EntityLookup from './pages/EntityLookup';
import CaseTracker  from './pages/CaseTracker';

export default function App() {
  return (
    <Routes>
      <Route path="/"            element={<Discover />} />
      <Route path="/case-lookup" element={<EntityLookup />} />
      <Route path="/case/:caseNumber" element={<CaseTracker />} />
    </Routes>
  );
}
