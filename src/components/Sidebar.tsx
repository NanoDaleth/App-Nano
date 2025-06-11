import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  GlassWater,
  Settings,
  History,
  FilePlus,
  Sparkles,
  Menu,
  X,
  BookOpen,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: GlassWater, text: 'Recetas Disponibles', path: '/recipes', adminOnly: false },
    { icon: Settings, text: 'Configuración de Ingredientes', path: '/ingredients', adminOnly: true },
    { icon: History, text: 'Historial', path: '/history', adminOnly: true },
    { icon: FilePlus, text: 'Nueva Receta', path: '/new-recipe', adminOnly: true },
    { icon: Sparkles, text: 'Limpieza', path: '/cleaning', adminOnly: true },
    { icon: BookOpen, text: 'Manual de Usuario', path: '/manual', adminOnly: true },
  ];

  const filteredMenuItems = menuItems.filter(item => !item.adminOnly || role === 'admin');

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-gray-900 text-white rounded-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div 
        className={`
          fixed md:relative
          inset-y-0 left-0
          w-64 bg-gray-900 text-white
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          z-50 md:z-auto
          h-full md:h-screen
          flex flex-col
        `}
      >
        <div className="p-4 border-b border-gray-700">
          <h1 className="font-bold text-xl">Cocktail Machine</h1>
          <p className="text-sm text-gray-400 mt-1">
            {role === 'admin' ? 'Administrador' : 'Usuario'}
          </p>
        </div>
        
        <nav className="flex-1 mt-6">
          {filteredMenuItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                flex items-center px-4 py-3 hover:bg-gray-800 transition-colors
                ${isActive ? 'bg-gray-800 border-l-4 border-blue-500' : ''}
              `}
            >
              <item.icon size={24} className="min-w-[24px]" />
              <span className="ml-4">{item.text}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center px-4 py-3 hover:bg-gray-800 transition-colors text-red-400 hover:text-red-300"
        >
          <LogOut size={24} className="min-w-[24px]" />
          <span className="ml-4">Cerrar Sesión</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;