import { Icon } from './Icon';

const NAV_LINKS = ['Trending', 'Sports', 'Concerts', 'Theater & Comedy'];

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

        {/* Navigation — Body/Regular */}
        <div className="flex items-center justify-end gap-6 text-body text-ink">
          {NAV_LINKS.map((link) => (
            <span key={link} className="whitespace-nowrap">
              {link}
            </span>
          ))}
          <span className="whitespace-nowrap">🇨🇦 CAD</span>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Icon name="user" />
            My Account
          </span>
        </div>
      </nav>
    </header>
  );
}
