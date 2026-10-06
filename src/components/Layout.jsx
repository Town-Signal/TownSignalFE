import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
const TABS = [
  ['대시보드', '/', 'M4 4h7v16H4zM13 4h7v7h-7zM13 13h7v7h-7z'],
  ['추천받기', '/recommend', 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'],
  ['직접찾기', '/search', 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'],
  ['비교하기', '/compare', 'M4 20V11h5v9zM15 20V5h5v15zM2.5 20h19'],
];

function Tabs({ iconSize }) {
  return TABS.map(([label, to, d]) => (
    <NavLink key={to} to={to} end={to === '/'}>
      <svg className="tab-icon" width={iconSize} height={iconSize} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
      {label}
    </NavLink>
  ));
}

export function Brand({ size = 28, as: Tag = Link }) {
  return (
    <Tag className="brand" {...(Tag === Link ? { to: '/' } : {})}>
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={size} height={size} />
      타운시그널
    </Tag>
  );
}

/** 모바일 상단 바. 화면마다 좌/우 버튼과 제목이 달라 각 페이지가 직접 렌더한다 (데스크톱에서는 CSS로 숨김) */
export function MobileHeader({ title, left, right, children }) {
  return (
    <header className="mob-header">
      {children ?? (
        <>
          {left}
          <span className="title">{title}</span>
          {right}
        </>
      )}
    </header>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);

  return (
    <div className="app">
      <header className="desk-header">
        <Brand />
        <nav className="desk-nav" aria-label="주 메뉴"><Tabs iconSize={17} /></nav>
      </header>
      <Suspense fallback={<main className="page" aria-busy="true" />}>
        <Outlet />
      </Suspense>
      <nav className="tabbar" aria-label="주 메뉴"><Tabs iconSize={22} /></nav>
    </div>
  );
}
