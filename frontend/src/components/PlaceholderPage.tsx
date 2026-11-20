type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">{description}</p>
    </section>
  )
}
