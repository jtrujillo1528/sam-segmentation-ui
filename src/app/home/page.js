// pages/home.js or app/home/page.js
import React from 'react';
import dynamic from 'next/dynamic'

const HomePage = dynamic(() => import('../../components/HomePage'), { ssr: false })

export default function Home() {
  return <HomePage />;
}