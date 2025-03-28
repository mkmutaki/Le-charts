
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { SupabaseListener } from './components/SupabaseListener';

function App() {
  return (
    <BrowserRouter>
      <SupabaseListener />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
