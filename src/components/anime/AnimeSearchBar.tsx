import Link from "next/link";

interface AnimeSearchBarProps {
  defaultValue?: string;
}

const AnimeSearchBar: React.FC<
  AnimeSearchBarProps
> = ({
  defaultValue = "",
}) => {
  return (
    <form
      action="/anime/search"
      method="get"
      className="flex w-full max-w-2xl items-center gap-2"
    >
      <div className="relative flex-1">
        <input
          type="search"
          name="q"
          defaultValue={
            defaultValue
          }
          placeholder="Search anime..."
          aria-label="Search anime"
          className="h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 pr-12 text-sm text-white outline-none backdrop-blur-sm transition focus:border-warning/50 focus:bg-black/50 placeholder:text-white/35"
        />

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-white/35">
          ⌕
        </span>
      </div>

      <button
        type="submit"
        className="h-12 rounded-xl bg-warning px-5 text-sm font-semibold text-black transition hover:brightness-110"
      >
        Search
      </button>

      {defaultValue && (
        <Link
          href="/anime"
          className="flex h-12 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          Clear
        </Link>
      )}
    </form>
  );
};

export default AnimeSearchBar;
