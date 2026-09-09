import { ChevronDown, Search, User } from 'lucide-react';

const NAV_LINKS = ['Trending', 'Sports', 'Concerts', 'Theater & Comedy'];

/**
 * Static production-style page chrome (promo bar + top nav), matched to the
 * Vivid Seats event page. Deliberately inert — no real search, navigation,
 * currency, or auth. Its job is to make the prototype read as vividseats.com.
 * Desktop only; on mobile the event-details header takes the top slot instead.
 */
export function SiteHeader() {
  return (
    <header className="shrink-0">
      {/* Promo / trust banner */}
      <div className="flex h-10 items-center justify-center bg-[#04092C] text-white">
        <span className="text-xs font-medium">
          100 million sold, 100% Buyer Guarantee.{' '}
          <span className="font-bold underline underline-offset-2">Learn More.</span>
        </span>
      </div>

      {/* Nav bar */}
      <nav
        aria-label="Main"
        className="flex h-[70px] items-center gap-8 bg-white px-11"
        style={{ borderBottom: '1px solid #efeff6' }}
      >
        <img src="/vslogo.svg" alt="Vivid Seats" width={152} className="shrink-0" />

        {/* Search (inert) */}
        <div
          aria-hidden
          className="flex h-11 w-[345px] shrink-0 items-center gap-2 rounded-full px-4 text-gray-500"
          style={{ backgroundColor: '#f6f6fb' }}
        >
          <Search className="h-[18px] w-[18px]" />
          <span className="text-sm">Search by artist, team, or venue</span>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-7 text-[#04092C]">
          {NAV_LINKS.map((link) => (
            <span key={link} className="text-base font-medium">
              {link}
            </span>
          ))}
          <span className="flex items-center gap-1 text-base font-medium">
            <span aria-hidden>🇨🇦</span>
            CAD
            <ChevronDown className="h-4 w-4" />
          </span>
          <span className="flex items-center gap-1.5 text-base font-medium">
            <User className="h-[22px] w-[22px]" strokeWidth={1.8} />
            My Account
          </span>
        </div>
      </nav>
    </header>
  );
}
