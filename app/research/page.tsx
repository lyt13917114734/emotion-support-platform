import type { Metadata } from 'next';
import ResearchDashboard from '@/components/research-dashboard';
import './research.css';

export const metadata: Metadata = { title: '研究者数据管理 · 公益心理服务平台', robots: { index: false, follow: false } };
export default function ResearchPage() { return <ResearchDashboard />; }
