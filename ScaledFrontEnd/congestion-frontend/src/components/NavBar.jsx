import { Link } from 'react-router-dom';

export default function NavBar() {
  return (
    <nav className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="font-bold text-xl tracking-wider">
            <Link to="/">🚀 NS3-AI Core</Link>
          </div>
          <div className="flex space-x-4 font-medium">
            <Link to="/arena" className="hover:bg-slate-700 px-3 py-2 rounded-md transition">Inference Arena</Link>
            <Link to="/lab" className="hover:bg-slate-700 px-3 py-2 rounded-md transition">Training Lab</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}