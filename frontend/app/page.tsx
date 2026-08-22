"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="landing-body">
      <style jsx global>{`
        :root {
          --paper: #FAF6F0;
          --paper-raised: #FFFFFF;
          --sidebar-bg: #F7F2EA;
          --ink-900: #1B1611;
          --ink-700: #3D362E;
          --ink-500: #8A8072;
          --ink-300: #B8AD9C;
          --border: #EAE2D6;
          --border-soft: #F0EAE0;
          --green: #128A52;
          --green-deep: #0E703F;
          --green-tint: #E6F4EB;
          --tan-100: #EFDBC2;
          --mint-100: #DEF0E5;
          --fail-bg: #FBE2E1;
          --fail-text: #C94A3F;
          --ready-bg: #E1F5E8;
          --ready-text: #128A52;
          --pending-bg: #FBF0D3;
          --pending-text: #A9822E;
          --credits-bg: #F2E3D8;
          --max: 1180px;
        }
        .landing-body {
          font-family: 'Inter', sans-serif;
          color: var(--ink-900);
          background: var(--paper);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }
        .landing-body h1, .landing-body h2, .landing-body h3, .landing-body h4 {
          font-family: 'Lora', Georgia, serif;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--ink-900);
        }
        .landing-body .mono {
          font-family: 'IBM Plex Mono', monospace;
        }
        .landing-body .wrap {
          max-width: var(--max);
          margin: 0 auto;
          padding: 0 32px;
        }
        .landing-body section { position: relative; }
        .landing-body .eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-300);
          padding-bottom: 9px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 20px;
          display: inline-block;
        }
        .landing-body .reveal {
          opacity: 0;
          transform: translateY(14px);
          transition: opacity .6s ease, transform .6s ease;
        }
        .landing-body .reveal.in {
          opacity: 1;
          transform: translateY(0);
        }
        .landing-body .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all .15s ease;
          white-space: nowrap;
          font-family: 'Inter', sans-serif;
        }
        .landing-body .btn-dark { background: var(--ink-900); color: var(--paper); }
        .landing-body .btn-dark:hover { background: #000; }
        .landing-body .btn-green { background: var(--green); color: #fff; }
        .landing-body .btn-green:hover { background: var(--green-deep); }
        .landing-body .btn-ghost { background: transparent; color: var(--ink-900); border-color: var(--border); }
        .landing-body .btn-ghost:hover { border-color: var(--ink-500); }
        .landing-body .btn-ghost-light { background: transparent; color: var(--paper); border-color: rgba(250,246,240,0.28); }
        .landing-body .btn-ghost-light:hover { border-color: var(--paper); }

        .landing-body header {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          background: rgba(250,246,240,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid transparent;
          transition: border-color .25s, background .25s;
        }
        .landing-body header.scrolled { border-color: var(--border); }
        .landing-body nav { display: flex; align-items: center; justify-content: space-between; height: 70px; width: 100%; }
        .landing-body .logo { display: flex; align-items: center; gap: 8px; font-family: 'Lora'; font-weight: 700; font-size: 20px; color: var(--ink-900); text-decoration: none; shrink: 0; }
        .landing-body .logo .spark { color: var(--green); font-size: 18px; }
        .landing-body .navlinks { display: flex; align-items: center; gap: 32px; font-size: 14px; color: var(--ink-700); font-weight: 500; }
        .landing-body .navlinks a { text-decoration: none; color: var(--ink-700); transition: color 0.15s ease; }
        .landing-body .navlinks a:hover { color: var(--ink-900); }
        .landing-body .navactions { display: flex; align-items: center; gap: 10px; }
        .landing-body .navactions .btn { padding: 10px 18px; font-size: 13.5px; text-decoration: none; }
        .landing-body .mobile-toggle { display: none; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--ink-900); padding: 4px; }
        .landing-body .mobile-menu { display: none; flex-direction: column; gap: 16px; padding: 20px 24px 28px; background: var(--paper-raised); border-bottom: 1px solid var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
        .landing-body .mobile-menu.open { display: flex; }
        .landing-body .mobile-menu a { font-size: 15px; color: var(--ink-900); text-decoration: none; font-weight: 500; }
        .landing-body .mobile-menu .m-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; pt-4; border-top: 1px solid var(--border-soft); }


        .landing-body .hero { padding: 150px 0 80px; }
        .landing-body .hero-top { text-align: center; max-width: 720px; margin: 0 auto 50px; }
        .landing-body .hero-top .eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          border: 1px solid var(--border); padding: 5px 13px;
          background: var(--paper-raised); border-radius: 999px;
        }
        .landing-body .hero-top .eyebrow::before { content: '✦'; color: var(--green); }
        .landing-body .hero h1 { font-size: 46px; line-height: 1.14; margin-bottom: 20px; }
        .landing-body .hero h1 .accent { color: var(--green); }
        .landing-body .hero p.sub { font-size: 16.5px; color: var(--ink-500); max-width: 520px; margin: 0 auto 30px; }
        .landing-body .hero-ctas { display: flex; gap: 12px; justify-content: center; margin-bottom: 14px; }
        .landing-body .hero-ctas .btn { padding: 13px 26px; font-size: 14.5px; }
        .landing-body .trust-line { font-family: 'IBM Plex Mono'; font-size: 12px; color: var(--ink-300); text-align: center; }

        .landing-body .app-frame {
          margin-top: 56px;
          border-radius: 20px;
          border: 1px solid var(--border);
          box-shadow: 0 30px 70px -30px rgba(27,22,17,0.25);
          overflow: hidden;
          display: grid;
          grid-template-columns: 220px 1fr;
          background: var(--paper-raised);
        }
        .landing-body .app-side { background: var(--sidebar-bg); padding: 22px 16px; border-right: 1px solid var(--border); }
        .landing-body .app-side-logo { display: flex; align-items: center; gap: 7px; font-family: 'Lora'; font-weight: 700; font-size: 16px; padding: 0 6px 22px; }
        .landing-body .app-side-logo .spark { color: var(--green); }
        .landing-body .app-eyebrow-sm { font-family: 'IBM Plex Mono'; font-size: 10px; letter-spacing: 0.08em; color: var(--ink-300); padding: 0 10px; margin-bottom: 8px; text-transform: uppercase; }
        .landing-body .app-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 999px; font-size: 13px; color: var(--ink-700); margin-bottom: 2px; }
        .landing-body .app-nav-item.active { background: var(--green-tint); color: var(--green-deep); font-weight: 500; }
        .landing-body .app-main { padding: 26px 28px; }
        .landing-body .app-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .landing-body .segpill { display: inline-flex; background: var(--paper); border: 1px solid var(--border); border-radius: 999px; padding: 3px; }
        .landing-body .segpill span { padding: 7px 16px; border-radius: 999px; font-size: 12.5px; font-family: 'IBM Plex Mono'; }
        .landing-body .segpill span.active { background: var(--ink-900); color: var(--paper); }
        .landing-body .credits-pill { background: var(--credits-bg); border-radius: 999px; padding: 7px 14px; font-family: 'IBM Plex Mono'; font-size: 12px; display: flex; align-items: center; gap: 5px; }
        .landing-body .app-greeting { font-size: 24px; margin-bottom: 6px; }
        .landing-body .app-status-row { display: flex; gap: 16px; font-family: 'IBM Plex Mono'; font-size: 12px; color: var(--ink-500); margin-bottom: 22px; }
        .landing-body .quick-card { background: var(--ink-900); border-radius: 16px; padding: 22px 24px; margin-bottom: 18px; }
        .landing-body .quick-card .qeyebrow { font-family: 'IBM Plex Mono'; font-size: 10.5px; letter-spacing: 0.08em; color: rgba(250,246,240,0.45); text-transform: uppercase; border-bottom: 1px solid rgba(250,246,240,0.15); display: inline-block; padding-bottom: 7px; margin-bottom: 12px; }
        .landing-body .quick-card h3 { color: var(--paper); font-size: 19px; margin-bottom: 4px; }
        .landing-body .quick-card p { color: rgba(250,246,240,0.55); font-size: 12.5px; }
        .landing-body .pill-row { display: flex; gap: 8px; margin-bottom: 22px; flex-wrap: wrap; }
        .landing-body .action-pill { display: flex; align-items: center; gap: 8px; background: var(--paper-raised); border: 1px solid var(--border); border-radius: 999px; padding: 8px 15px 8px 8px; font-size: 12.5px; color: var(--ink-700); font-weight: 500; }
        .landing-body .action-pill .dot { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; }
        .landing-body .list-row { display: flex; align-items: center; gap: 12px; background: var(--paper-raised); border: 1px solid var(--border); border-radius: 11px; padding: 12px 14px; margin-bottom: 8px; }
        .landing-body .list-row .icon-tint { width: 34px; height: 34px; border-radius: 9px; background: var(--green-tint); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .landing-body .list-row .rt { flex: 1; min-width: 0; }
        .landing-body .list-row .rt .t { font-size: 13px; font-weight: 500; }
        .landing-body .list-row .rt .d { font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--ink-300); margin-top: 2px; }
        .landing-body .status-pill { font-family: 'IBM Plex Mono'; font-size: 10px; padding: 4px 10px; border-radius: 999px; font-weight: 500; flex-shrink: 0; }
        .landing-body .status-ready { background: var(--ready-bg); color: var(--ready-text); }
        .landing-body .status-pending { background: var(--pending-bg); color: var(--pending-text); }

        .landing-body .proof-strip { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 32px 0; }
        .landing-body .proof-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; text-align: center; }
        .landing-body .proof-grid .num { font-family: 'Lora'; font-size: 27px; font-weight: 700; }
        .landing-body .proof-grid .lbl { font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--ink-300); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 5px; }

        .landing-body .section-head { max-width: 600px; margin-bottom: 48px; }
        .landing-body .section-head h2 { font-size: 32px; line-height: 1.18; margin-bottom: 12px; }
        .landing-body .section-head p { font-size: 15.5px; color: var(--ink-500); }
        .landing-body .pad { padding: 104px 0; }
        .landing-body .pad-tight { padding: 88px 0; }

        .landing-body .discover-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .landing-body .discover-card { border-radius: 16px; padding: 22px; min-height: 220px; display: flex; flex-direction: column; justify-content: space-between; }
        .landing-body .discover-card.dark { background: var(--ink-900); color: var(--paper); }
        .landing-body .discover-card.dark h3 { color: var(--paper); }
        .landing-body .discover-card.tan { background: var(--tan-100); color: var(--ink-900); }
        .landing-body .discover-card.mint { background: var(--mint-100); color: var(--ink-900); }
        .landing-body .discover-tag { font-family: 'IBM Plex Mono'; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 10px; border-radius: 999px; display: inline-block; width: fit-content; }
        .landing-body .discover-card.dark .discover-tag { background: rgba(250,246,240,0.12); color: rgba(250,246,240,0.7); }
        .landing-body .discover-card.tan .discover-tag, .landing-body .discover-card.mint .discover-tag { background: rgba(27,22,17,0.08); color: var(--ink-700); }
        .landing-body .discover-card h3 { font-size: 17px; margin: 12px 0 6px; line-height: 1.25; font-family: 'Lora'; }
        .landing-body .discover-card p { font-size: 12.5px; opacity: 0.8; line-height: 1.5; }

        .landing-body .ps-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
        .landing-body .ps-col { padding: 36px 34px; }
        .landing-body .ps-col.problem { background: var(--paper-raised); border-right: 1px solid var(--border); }
        .landing-body .ps-col.solution { background: var(--ink-900); color: var(--paper); }
        .landing-body .ps-tag { font-family: 'IBM Plex Mono'; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; display: block; }
        .landing-body .ps-col.problem .ps-tag { color: var(--fail-text); }
        .landing-body .ps-col.solution .ps-tag { color: #8FE0B4; }
        .landing-body .ps-item { display: flex; gap: 11px; padding: 11px 0; border-top: 1px solid var(--border-soft); font-size: 13.5px; }
        .landing-body .ps-col.solution .ps-item { border-color: rgba(250,246,240,0.1); }
        .landing-body .ps-item:first-of-type { border-top: none; }
        .landing-body .ps-item .x { color: var(--fail-text); font-family: 'IBM Plex Mono'; flex-shrink: 0; }
        .landing-body .ps-item .c { color: #8FE0B4; font-family: 'IBM Plex Mono'; flex-shrink: 0; }
        .landing-body .ps-col.problem .ps-item span:last-child { color: var(--ink-500); }
        .landing-body .ps-col.solution .ps-item span:last-child { color: rgba(250,246,240,0.75); }

        .landing-body .feat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
        .landing-body .feat-card { background: var(--paper-raised); padding: 26px 24px; position: relative; }
        .landing-body .feat-num { font-family: 'IBM Plex Mono'; font-size: 11px; font-weight: 500; color: var(--ink-500); margin-bottom: 10px; }
        .landing-body .feat-card h3 { font-size: 15.5px; margin-bottom: 8px; font-family: 'Lora'; }
        .landing-body .feat-card p { font-size: 12.5px; color: var(--ink-500); line-height: 1.55; }

        .landing-body .quote-card { background: var(--credits-bg); border-radius: 14px; padding: 20px 22px; display: flex; align-items: center; gap: 16px; max-width: 700px; margin: 0 auto; }
        .landing-body .quote-card .qi { width: 40px; height: 40px; border-radius: 50%; background: var(--ink-900); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--paper); font-size: 16px; }
        .landing-body .quote-card .qname { font-weight: 600; font-size: 14px; margin-bottom: 3px; }
        .landing-body .quote-card .qtext { font-size: 13px; color: var(--ink-500); font-style: italic; }

        .landing-body .pricing-toggle { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 44px; }
        .landing-body .toggle-track { width: 44px; height: 25px; background: var(--ink-900); border-radius: 999px; position: relative; cursor: pointer; }
        .landing-body .toggle-thumb { width: 19px; height: 19px; background: var(--paper); border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: transform .18s ease; }
        .landing-body .toggle-track.annual .toggle-thumb { transform: translateX(19px); }
        .landing-body .toggle-label { font-family: 'IBM Plex Mono'; font-size: 12.5px; color: var(--ink-500); }
        .landing-body .toggle-label.active { color: var(--ink-900); font-weight: 500; }
        .landing-body .save-badge { font-family: 'IBM Plex Mono'; font-size: 10.5px; background: var(--green-tint); color: var(--green-deep); padding: 3px 9px; border-radius: 999px; }
        .landing-body .price-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; align-items: stretch; }
        .landing-body .price-card { background: var(--paper-raised); border: 1px solid var(--border); border-radius: 16px; padding: 32px 24px 26px; display: flex; flex-direction: column; position: relative; }
        .landing-body .price-card.featured { border: 2px solid var(--green); }
        .landing-body .price-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--green); color: #fff; font-family: 'IBM Plex Mono'; font-size: 10px; padding: 5px 13px; border-radius: 999px; white-space: nowrap; z-index: 10; font-weight: 500; letter-spacing: 0.05em; }
        .landing-body .price-card h3 { font-size: 18px; margin-bottom: 4px; font-family: 'Lora'; }
        .landing-body .price-card .desc { font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--ink-500); margin-bottom: 20px; letter-spacing: 0.05em; }
        .landing-body .price-amt { font-family: 'Lora'; font-size: 29px; font-weight: 700; margin-bottom: 2px; }
        .landing-body .price-amt .per { font-family: 'IBM Plex Mono'; font-size: 12px; font-weight: 400; color: var(--ink-300); }
        .landing-body .price-included { font-family: 'IBM Plex Mono'; font-size: 11px; color: var(--ink-500); margin-bottom: 20px; }
        .landing-body .price-feats { list-style: none; margin-bottom: 22px; flex-grow: 1; }
        .landing-body .price-feats li { font-size: 12.5px; color: var(--ink-500); padding: 7px 0; display: flex; gap: 8px; border-top: 1px solid var(--border-soft); }
        .landing-body .price-feats li:first-child { border: none; }
        .landing-body .price-feats li::before { content: '✓'; color: var(--green); flex-shrink: 0; font-weight: 600; }
        .landing-body .price-card .btn { width: 100%; }

        .landing-body .faq-list { max-width: 740px; margin: 0 auto; }
        .landing-body .faq-item { border-top: 1px solid var(--border); padding: 20px 0; }
        .landing-body .faq-item:last-child { border-bottom: 1px solid var(--border); }
        .landing-body .faq-q { display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 15px; font-weight: 600; font-family: 'Lora'; }
        .landing-body .faq-q .plus { font-family: 'IBM Plex Mono'; font-size: 15px; color: var(--ink-300); transition: transform .2s ease; }
        .landing-body .faq-item.open .plus { transform: rotate(45deg); }
        .landing-body .faq-a { max-height: 0; overflow: hidden; transition: max-height .3s ease; }
        .landing-body .faq-item.open .faq-a { max-height: 220px; }
        .landing-body .faq-a p { font-size: 13.5px; color: var(--ink-500); padding-top: 13px; line-height: 1.62; max-width: 620px; }

        .landing-body .final-cta { background: var(--ink-900); border-radius: 22px; padding: 70px 56px; text-align: center; }
        .landing-body .final-cta h2 { color: var(--paper); font-size: 32px; margin-bottom: 14px; }
        .landing-body .final-cta p { color: rgba(250,246,240,0.6); font-size: 15px; margin-bottom: 28px; font-family: 'IBM Plex Mono'; }
        .landing-body .final-cta .hero-ctas { justify-content: center; }

        .landing-body footer { border-top: 1px solid var(--border); padding: 56px 0 30px; }
        .landing-body .foot-grid { display: grid; grid-template-columns: 1.4fr repeat(4,1fr); gap: 30px; margin-bottom: 44px; }
        .landing-body .foot-brand p { font-size: 13px; color: var(--ink-500); margin-top: 13px; max-width: 230px; line-height: 1.6; }
        .landing-body .foot-col h5 { font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--ink-300); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; font-weight: 600; }
        .landing-body .foot-col a { display: block; font-size: 13px; color: var(--ink-500); padding: 5px 0; }
        .landing-body .foot-col a:hover { color: var(--ink-900); }
        .landing-body .foot-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 24px; border-top: 1px solid var(--border); font-family: 'IBM Plex Mono'; font-size: 11px; color: var(--ink-300); }

        @media (max-width: 980px) {
          .landing-body .navlinks { display: none; }
          .landing-body .navactions { display: none; }
          .landing-body .mobile-toggle { display: block; }
          .landing-body .app-frame { grid-template-columns: 1fr; }
          .landing-body .app-side { display: none; }
          .landing-body .ps-grid, .landing-body .discover-grid { grid-template-columns: 1fr 1fr; }
          .landing-body .hero h1 { font-size: 34px; }
          .landing-body .proof-grid { grid-template-columns: repeat(2,1fr); gap: 26px; }
          .landing-body .feat-grid { grid-template-columns: 1fr 1fr; }
          .landing-body .price-grid { grid-template-columns: 1fr 1fr; }
          .landing-body .foot-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
          .landing-body .ps-col.problem { border-right: none; border-bottom: 1px solid var(--border); }
        }
        @media (max-width: 620px) {
          .landing-body .wrap { padding: 0 20px; }
          .landing-body .proof-grid, .landing-body .feat-grid, .landing-body .price-grid, .landing-body .discover-grid { grid-template-columns: 1fr; }
          .landing-body .hero { padding-top: 130px; }
          .landing-body .hero h1 { font-size: 28px; }
          .landing-body .foot-grid { grid-template-columns: 1fr; }
          .landing-body .foot-bottom { flex-direction: column; gap: 9px; align-items: flex-start; }
          .landing-body .final-cta { padding: 48px 24px; }
        }
      `}</style>

      {/* Header */}
      <header id="siteHeader" className={scrolled ? "scrolled" : ""}>
        <nav className="wrap">
          <Link href="/" className="logo">
            <span className="spark">✦</span>cognitio
          </Link>

          <div className="navlinks">
            <a href="#solutions">Solutions</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="navactions">
            <Link href="/login" className="btn btn-ghost">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-dark">
              Start free trial
            </Link>
          </div>

          <button
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </nav>

        {/* Mobile menu dropdown */}
        <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
          <a href="#solutions" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
          <div className="m-actions">
            <Link href="/login" className="btn btn-ghost" style={{ textAlign: "center" }}>
              Log in
            </Link>
            <Link href="/signup" className="btn btn-dark" style={{ textAlign: "center" }}>
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-top">
            <span className="eyebrow">Built for African schools</span>
            <h1>
              Run your entire school from <span className="accent">one intelligent platform.</span>
            </h1>
            <p className="sub">
              Cognitio ERP brings admissions, academics, finance, attendance, communication, and analytics together in one place — powered by Stella, the intelligence layer across everything we build.
            </p>
            <div className="hero-ctas">
              <Link href="/signup" className="btn btn-green">
                Start free trial
              </Link>
              <Link href="/login" className="btn btn-ghost">
                Book a demo
              </Link>
            </div>
            <div className="trust-line">30-day trial · no card required · live in a day</div>
          </div>

          {/* App Frame Mockup */}
          <div className="app-frame reveal">
            <div className="app-side">
              <div className="app-side-logo">
                <span className="spark">✦</span>cognitio
              </div>
              <div className="app-eyebrow-sm">Main</div>
              <Link href="/dashboard" className="app-nav-item active">
                Dashboard
              </Link>
              <Link href="/students" className="app-nav-item">
                Students
              </Link>
              <Link href="/teachers" className="app-nav-item">
                Teachers
              </Link>
              <Link href="/attendance" className="app-nav-item">
                Attendance
              </Link>
              <div className="app-eyebrow-sm" style={{ marginTop: "16px" }}>
                Operate
              </div>
              <Link href="/finance" className="app-nav-item">
                Finance
              </Link>
              <Link href="/results" className="app-nav-item">
                Results
              </Link>
              <Link href="/communication" className="app-nav-item">
                Communication
              </Link>
              <Link href="/settings" className="app-nav-item">
                Settings
              </Link>
            </div>

            <div className="app-main">
              <div className="app-topbar">
                <div className="segpill">
                  <span className="active">Dashboard</span>
                  <span>✦ Stella</span>
                </div>
                <div className="credits-pill">✦ Term 1, 2026</div>
              </div>
              <h3 className="app-greeting">Good morning, Mrs. Adeyemi 👋</h3>
              <div className="app-status-row">
                <span>🔥 96% attendance today</span>
                <span>🕐 842 students</span>
              </div>

              <div className="quick-card">
                <span className="qeyebrow">Quick action</span>
                <h3>Generate this term's invoices</h3>
                <p>SS2 fee structure is set — invoice all 84 students in one tap →</p>
              </div>

              <div className="pill-row">
                <Link href="/attendance" className="action-pill">
                  <span className="dot" style={{ background: "#1B1611" }}></span>Mark attendance
                </Link>
                <Link href="/results" className="action-pill">
                  <span className="dot" style={{ background: "#D97B3F" }}></span>Enter results
                </Link>
                <Link href="/students" className="action-pill">
                  <span className="dot" style={{ background: "#5B5FE0" }}></span>Add student
                </Link>
                <Link href="/communication" className="action-pill">
                  <span className="dot" style={{ background: "#128A52" }}></span>Post announcement
                </Link>
              </div>

              <div className="list-row">
                <div className="icon-tint">📄</div>
                <div className="rt">
                  <div className="t">Report cards — Term 1</div>
                  <div className="d">SS2 · 84 students</div>
                </div>
                <span className="status-pill status-ready">READY</span>
              </div>
              <div className="list-row">
                <div className="icon-tint">💳</div>
                <div className="rt">
                  <div className="t">Amaka O. — fee payment</div>
                  <div className="d">SS2 Gold · ₦45,000</div>
                </div>
                <span className="status-pill status-pending">DUE FRI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Strip */}
      <div className="proof-strip">
        <div className="wrap proof-grid">
          <div>
            <div className="num">120+</div>
            <div className="lbl">Schools onboarding</div>
          </div>
          <div>
            <div className="num">38K+</div>
            <div className="lbl">Students managed</div>
          </div>
          <div>
            <div className="num">2</div>
            <div className="lbl">States, growing</div>
          </div>
          <div>
            <div className="num">99.9%</div>
            <div className="lbl">Uptime target</div>
          </div>
        </div>
      </div>

      {/* Problem & Solution */}
      <section className="pad" id="solutions">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">The problem</span>
            <h2>Most schools run on paper, Excel, and hope.</h2>
            <p>
              Attendance in one book. Results in Word. Fees in a cash box. It works — until it doesn't, and by then a term's worth of records is gone.
            </p>
          </div>
          <div className="ps-grid reveal">
            <div className="ps-col problem">
              <span className="ps-tag">Without Cognitio</span>
              <div className="ps-item">
                <span className="x">✕</span>
                <span>Attendance books that get lost or never reconciled</span>
              </div>
              <div className="ps-item">
                <span className="x">✕</span>
                <span>Results computed by hand, slow to release</span>
              </div>
              <div className="ps-item">
                <span className="x">✕</span>
                <span>Fee status nobody can answer without digging</span>
              </div>
              <div className="ps-item">
                <span className="x">✕</span>
                <span>Five tools that don't talk to each other</span>
              </div>
            </div>
            <div className="ps-col solution">
              <span className="ps-tag">With Cognitio</span>
              <div className="ps-item">
                <span className="c">✓</span>
                <span>Attendance synced automatically, works offline</span>
              </div>
              <div className="ps-item">
                <span className="c">✓</span>
                <span>Report cards generated in minutes, branded to you</span>
              </div>
              <div className="ps-item">
                <span className="c">✓</span>
                <span>Outstanding fees visible instantly</span>
              </div>
              <div className="ps-item">
                <span className="c">✓</span>
                <span>One platform, admissions to graduation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Included Features */}
      <section className="pad-tight" id="features">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Everything included</span>
            <h2>One system for every part of running a school.</h2>
            <p>No add-on tiers for the features you need on day one.</p>
          </div>
          <div className="feat-grid reveal">
            <div className="feat-card">
              <div className="feat-num">01</div>
              <h3>Admissions & students</h3>
              <p>From application to enrollment, with bulk import from Excel in minutes.</p>
            </div>
            <div className="feat-card">
              <div className="feat-num">02</div>
              <h3>Attendance</h3>
              <p>Works fully offline, syncs automatically when connectivity returns.</p>
            </div>
            <div className="feat-card">
              <div className="feat-num">03</div>
              <h3>Results</h3>
              <p>Continuous assessment, exam scores, branded report cards, printable transcripts.</p>
            </div>
            <div className="feat-card">
              <div className="feat-num">04</div>
              <h3>Finance</h3>
              <p>Invoices, installments, online payment collection, a live view of who owes what.</p>
            </div>
            <div className="feat-card">
              <div className="feat-num">05</div>
              <h3>Communication</h3>
              <p>Announcements and a parent help desk — structured, never a chaotic group chat.</p>
            </div>
            <div className="feat-card">
              <div className="feat-num">06</div>
              <h3>Stella AI</h3>
              <p>Report comments, plain-English answers, early-warning insight — quietly, where it helps.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Discovery Cards */}
      <section className="pad">
        <div className="wrap">
          <div className="section-head reveal" style={{ margin: "0 auto 40px", textAlign: "center" }}>
            <span className="eyebrow" style={{ margin: "0 auto 20px", display: "table" }}>
              Broaden what your school can do
            </span>
            <h2>Grows with you — one product at a time.</h2>
          </div>
          <div className="discover-grid reveal">
            <div className="discover-card dark">
              <span className="discover-tag">Learning</span>
              <div>
                <h3>Cognitio LMS</h3>
                <p>Course content, lesson videos, and assignments — launching straight from your ERP, one login.</p>
              </div>
            </div>
            <div className="discover-card tan">
              <span className="discover-tag">Assessment</span>
              <div>
                <h3>Cognitio Assess</h3>
                <p>Give a class a quiz or a full exam — practice, org-wide, or secure on-premises CBT.</p>
              </div>
            </div>
            <div className="discover-card mint">
              <span className="discover-tag">Intelligence</span>
              <div>
                <h3>Stella AI</h3>
                <p>The layer powering all three — report comments, insight, and answers, on demand.</p>
              </div>
            </div>
            <div className="discover-card dark">
              <span className="discover-tag">Coming next</span>
              <div>
                <h3>Alumni Network</h3>
                <p>Stay connected to graduates — verified transcripts, mentorship, and referrals.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Banner */}
      <section className="pad-tight">
        <div className="wrap">
          <div className="quote-card reveal">
            <div className="qi">✦</div>
            <div>
              <div className="qname">Rev. Sr. Ngozi</div>
              <div className="qtext">
                "We moved off three spreadsheets in one week. The import mapped everything — we didn't retype a single record."
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pad-tight" id="pricing">
        <div className="wrap">
          <div className="section-head reveal" style={{ margin: "0 auto 20px", textAlign: "center" }}>
            <span className="eyebrow" style={{ margin: "0 auto 20px", display: "table" }}>
              Pricing
            </span>
            <h2>Simple pricing. Nothing gated.</h2>
            <p style={{ margin: "0 auto" }}>Every plan includes the full platform. You only pay more as your school grows.</p>
          </div>

          <div className="pricing-toggle reveal">
            <span className={`toggle-label ${!annual ? "active" : ""}`}>Monthly</span>
            <div
              className={`toggle-track ${annual ? "annual" : ""}`}
              onClick={() => setAnnual(!annual)}
            >
              <div className="toggle-thumb" />
            </div>
            <span className={`toggle-label ${annual ? "active" : ""}`}>Annual</span>
            <span className="save-badge">2 months free</span>
          </div>

          <div className="price-grid reveal">
            {/* Foundation Plan */}
            <div className="price-card">
              <h3>Foundation</h3>
              <div className="desc">UP TO 200 STUDENTS</div>
              <div className="price-amt">
                <span>{annual ? "₦20,833" : "₦25,000"}</span>
                <span className="per">/month</span>
              </div>
              <div className="price-included">+₦120/student beyond 200</div>
              <ul className="price-feats">
                <li>Full platform, no gating</li>
                <li>Admissions & attendance</li>
                <li>Results & report cards</li>
                <li>Fees & finance</li>
              </ul>
              <Link href="/signup" className="btn btn-ghost">
                Start free trial
              </Link>
            </div>

            {/* Academy Plan (Featured) */}
            <div className="price-card featured">
              <div className="price-badge">Most popular</div>
              <h3>Academy</h3>
              <div className="desc">UP TO 450 STUDENTS</div>
              <div className="price-amt">
                <span>{annual ? "₦41,667" : "₦50,000"}</span>
                <span className="per">/month</span>
              </div>
              <div className="price-included">+₦90/student beyond 450</div>
              <ul className="price-feats">
                <li>Everything in Foundation</li>
                <li>Inventory & HR/Payroll</li>
                <li>Priority onboarding</li>
              </ul>
              <Link href="/signup" className="btn btn-green">
                Start free trial
              </Link>
            </div>

            {/* Excellence Plan */}
            <div className="price-card">
              <h3>Excellence</h3>
              <div className="desc">UP TO 1,000 STUDENTS</div>
              <div className="price-amt">
                <span>{annual ? "₦83,333" : "₦100,000"}</span>
                <span className="per">/month</span>
              </div>
              <div className="price-included">Includes Stella AI</div>
              <ul className="price-feats">
                <li>Everything in Academy</li>
                <li>Multi-campus ready</li>
                <li>Advanced analytics</li>
              </ul>
              <Link href="/signup" className="btn btn-ghost">
                Start free trial
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="price-card">
              <h3>Enterprise</h3>
              <div className="desc">MULTI-CAMPUS</div>
              <div className="price-amt">Custom</div>
              <div className="price-included">Tailored to your group</div>
              <ul className="price-feats">
                <li>Everything in Excellence</li>
                <li>Custom domain & SSO</li>
                <li>Dedicated infrastructure</li>
              </ul>
              <Link href="/login" className="btn btn-ghost">
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="pad-tight" id="faq">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Questions</span>
            <h2>Frequently asked questions</h2>
          </div>
          <div className="faq-list reveal">
            <div className={`faq-item ${openFaq === 0 ? "open" : ""}`}>
              <div className="faq-q" onClick={() => toggleFaq(0)}>
                <span>How long does migration take?</span>
                <span className="plus">+</span>
              </div>
              <div className="faq-a">
                <p>Most schools are fully migrated within a day. Upload your Excel sheets and the import tool maps the columns automatically.</p>
              </div>
            </div>

            <div className={`faq-item ${openFaq === 1 ? "open" : ""}`}>
              <div className="faq-q" onClick={() => toggleFaq(1)}>
                <span>What happens if our internet goes down?</span>
                <span className="plus">+</span>
              </div>
              <div className="faq-a">
                <p>Attendance and fee recording keep working offline, and sync automatically once connectivity returns.</p>
              </div>
            </div>

            <div className={`faq-item ${openFaq === 2 ? "open" : ""}`}>
              <div className="faq-q" onClick={() => toggleFaq(2)}>
                <span>Can we pay per term?</span>
                <span className="plus">+</span>
              </div>
              <div className="faq-a">
                <p>Yes — termly billing is invoiced against your school's own term dates, not a fixed calendar.</p>
              </div>
            </div>

            <div className={`faq-item ${openFaq === 3 ? "open" : ""}`}>
              <div className="faq-q" onClick={() => toggleFaq(3)}>
                <span>Who owns our data?</span>
                <span className="plus">+</span>
              </div>
              <div className="faq-a">
                <p>Your school. It's yours to export at any time — there's no lock-in.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pad">
        <div className="wrap">
          <div className="final-cta">
            <h2>Ready before resumption?</h2>
            <p>Most schools are fully onboarded within a day.</p>
            <div className="hero-ctas">
              <Link href="/signup" className="btn btn-green">
                Start free trial
              </Link>
              <Link href="/login" className="btn btn-ghost-light">
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <div className="logo">
                <span className="spark">✦</span>cognitio
              </div>
              <p>The intelligence infrastructure for education. Built by Hackverse Technologies.</p>
            </div>
            <div className="foot-col">
              <h5>Product</h5>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#">Stella AI</a>
            </div>
            <div className="foot-col">
              <h5>Ecosystem</h5>
              <a href="#">Cognitio LMS</a>
              <a href="#">Cognitio Assess</a>
            </div>
            <div className="foot-col">
              <h5>Company</h5>
              <a href="#">About</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className="foot-col">
              <h5>Legal</h5>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Hackverse Technologies</span>
            <span>Made for schools across Nigeria and Africa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
