import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';

// 화면 단위 코드 스플리팅
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Recommend = lazy(() => import('./pages/Recommend/Recommend'));
const Search = lazy(() => import('./pages/Search/Search'));
const Detail = lazy(() => import('./pages/Detail/Detail'));
const Compare = lazy(() => import('./pages/Compare/Compare'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="recommend" element={<Recommend />} />
        <Route path="search" element={<Search />} />
        <Route path="dong/:name" element={<Detail />} />
        <Route path="compare" element={<Compare />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
