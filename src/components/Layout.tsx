import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <Header onMenuClick={() => setIsSidebarOpen(true)} />

                {/* Main Content Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 pb-8">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                        {/* The routed page content will go here */}
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
