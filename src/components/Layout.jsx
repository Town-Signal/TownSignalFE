import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ICONS, Icon } from './ui';
import { REDUCED_MOTION, useMediaQuery } from '../hooks/useMediaQuery';

const TO_TOP_AFTER = 240; // 이만큼 내려가면 '맨 위로' 버튼을 띄운다(px). 데스크톱 대시보드는 끝까지 내려도 300px 남짓이라 낮게 잡는다

const TABS = [
  ['대시보드', '/', 'M4 4h7v16H4zM13 4h7v7h-7zM13 13h7v7h-7z'],
  ['추천받기', '/recommend', ICONS.spark],
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

/**
 * 맨 위로 버튼. 스크롤을 내리면 오른쪽 아래에 떠오르고, 누르면 부드럽게 맨 위로 간다(동작 줄이기면 바로).
 * 늘 DOM에 두고 .show로 나타나고 사라지는 전환을 준다. 숨어 있을 때는 탭 이동 · 화면 읽기에서 뺀다
 */
function ScrollTopButton() {
  const [show, setShow] = useState(false);
  const reduce = useMediaQuery(REDUCED_MOTION);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > TO_TOP_AFTER); // 같은 값이면 React가 다시 그리지 않는다
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      className={`to-top ${show ? 'show' : ''}`}
      aria-label="맨 위로"
      title="맨 위로"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        // 버튼은 곧 숨겨지므로 포커스를 본문 맨 앞으로 옮긴다(키보드 사용자가 다음 Tab에서 길을 잃지 않게)
        const main = document.querySelector('main');
        if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }); }
      }}
    >
      <Icon name="arrowUp" size={20} />
    </button>
  );
}

/** 바닥글: 글자만(소개 · 참고 안내 | 저작권). 메뉴는 상단 바 · 탭바에 있다. 연도는 지금 해로 */
function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="sf-text">
          <p>내 자본금과 지원금으로 갈 수 있는 서울 창업 입지를 데이터로 추천해요.</p>
          <p>예측은 참고용이에요. 최종 판단과 책임은 사용자에게 있어요.</p>
        </div>
        <p className="sf-copy">© {year} TownSignal. All rights reserved.</p>
      </div>
    </footer>
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
      {/* 직접찾기는 화면 전체가 지도라 바닥글을 두지 않는다 */}
      {pathname !== '/search' && <SiteFooter />}
      <nav className="tabbar" aria-label="주 메뉴"><Tabs iconSize={22} /></nav>
      <ScrollTopButton />
    </div>
  );
}
