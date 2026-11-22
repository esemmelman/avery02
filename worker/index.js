export default {
  fetch() {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "https://esemmelman.github.io/avery02/?from-retired=1",
        "Cache-Control": "no-store",
      },
    });
  },
};
