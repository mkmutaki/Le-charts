
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { SupabaseListener } from './components/SupabaseListener';

import './App.css';

function App() {
  return (
    <>
      <SupabaseListener />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-center" />
    </>
  );
}

export default App;
