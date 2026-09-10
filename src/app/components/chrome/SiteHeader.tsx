import { Icon } from './Icon';

const NAV_LINKS = ['Explore', 'Trending', 'Sports', 'Concerts', 'Theater & Comedy'];

/**
 * Static production page chrome (global banner + navbar), matched 1:1 to the
 * Figma <navbar> (42px banner + 76px nav). Deliberately inert — no search,
 * navigation, currency, or auth. Desktop only.
 */
export function SiteHeader() {
  return (
    <header className="shrink-0 border-b border-line bg-white">
      {/* Global banner — Caption/Medium on text/primary */}
      <div className="flex items-center justify-center bg-ink py-3">
        <p className="whitespace-nowrap text-caption font-medium text-white">
          100 million sold, 100% Buyer Guarantee. Learn More.
        </p>
      </div>

      <nav aria-label="Main" className="flex min-h-[76px] items-center justify-between px-6 py-4">
        {/* Logo + search */}
        <div className="flex items-center gap-10">
          <img src="/vslogo.svg" alt="Vivid Seats" width={156} className="shrink-0" />
          <div
            aria-hidden
            className="flex w-[343px] shrink-0 items-center gap-2 rounded-full bg-surface-50 px-4 py-2.5"
          >
            <Icon name="search" />
            <span className="whitespace-nowrap text-body text-ink-muted">
              Search by artist, team, or venue
            </span>
          </div>
        </div>

        {/* Navigation — production nav: Medium links, circular flag + currency, account icon */}
        <div className="flex items-center justify-end gap-6 text-body font-medium text-ink">
          {NAV_LINKS.map((link) => (
            <span key={link} className="whitespace-nowrap">
              {link}
            </span>
          ))}
          <span className="flex items-center gap-2 whitespace-nowrap">
            <img src="/icons/flag-us.svg" alt="" aria-hidden draggable={false} className="h-5 w-5 shrink-0" />
            USD
          </span>
          <span aria-label="My Account" className="flex items-center">
            <Icon name="user" size={24} glyph={18} />
          </span>
        </div>
      </nav>
    </header>
  );
}
