import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="eyebrow text-brand-600">Error 404</p>
      <h1 className="heading-caps mt-3 text-3xl">Page not found</h1>
      <p className="mt-3 text-muted">The page you were looking for doesn’t exist or has moved.</p>
      <Link href="/collections/all" className="btn-solid mt-8">
        Shop all perfumes
      </Link>
    </div>
  );
}
