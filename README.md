# TheNot: Your Next Wedding Planner

[TheNot](https://wedding-approuter.vercel.app/) is not TheKnot... but also is as it's a clone of [theknot.com](https://www.theknot.com/).
Using the power of the [T3 Stack](https://create.t3.gg/), I've taken up this full stack hobby project to attempt to recreate portions of this popular wedding planning platform.

It is scaffolded with `create-t3-app` ([repo](https://github.com/t3-oss/create-t3-app)) and hosted on [Vercel](https://vercel.com/) at https://wedding-approuter.vercel.app/. Everything from the design to the layout to the modeling of the data/schemas were done from scratch and by solely looking at and tinkering with the TheKnot website.

## So What Features were Recreated?
I really just focused on the baseline custom wedding website features and rsvp & guest list management functionalities. That being said, I haven't prioritized a landing page or dedicated login/account management yet, so this is where you'll start...<br>

<img width="300" alt="Screenshot 2024-05-01 at 2 21 01 AM" src="https://github.com/Kenford20/wedding-approuter/assets/41027303/f6c8c536-72d3-4cc9-80cd-c55411cbca9d">
<img width="252" alt="Screenshot 2024-05-01 at 2 32 25 AM" src="https://github.com/Kenford20/wedding-approuter/assets/41027303/aeb7ec1a-e1be-443f-8233-325fe39ca53c">

<br>You can create an account with either Google or Github - I opted to use [Clerk](https://clerk.com/) to handle user management & authentication rather than [NextAuth.js](https://next-auth.js.org)
