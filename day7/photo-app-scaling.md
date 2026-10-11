# SnapShare Scaling Plan

## Assumptions and Estimates

- There are 10 million registered users, and 10% are active each day: **1 million daily active users (DAU)**.
- Each DAU uploads one photo and views 50 feed pages each day.
- A day has 86,400 seconds; the estimates below are daily averages spread across the day. Peak feed traffic is estimated at 5 times the average.
- Each original photo is 2 MB and each photo gets one 50 KB thumbnail. Use decimal units (1 MB = 1,000 KB, 1 TB = 1,000,000 MB), 365 days per year, and assume photos are retained without deletion.
- Storage estimates count one copy of each original and thumbnail, not database backups, replicas, other image sizes, or operational overhead.

### Request and Storage Estimates

- **Uploads per day:** 1,000,000 DAU × 1 upload = 1,000,000 uploads/day.
- **Average uploads per second:** 1,000,000 ÷ 86,400 = **about 11.6 uploads/second**.
- **Feed views per day:** 1,000,000 DAU × 50 pages = 50,000,000 views/day.
- **Average feed views per second:** 50,000,000 ÷ 86,400 = **about 579 views/second**.
- **Peak feed views per second:** (50,000,000 ÷ 86,400) × 5 = **about 2,894 views/second** (rounded from the unrounded average).
- **Original photo storage per year:** 1,000,000 × 2 MB × 365 = 730,000,000 MB = **730 TB/year**.
- **Thumbnail storage per year:** 1,000,000 × 0.05 MB × 365 = 18,250,000 MB = **18.25 TB/year**.
- **Total new photo-file storage per year:** 730 TB + 18.25 TB = **748.25 TB/year**, before replication and other overhead.

SnapShare is **read-heavy** by request count: users request 50 feed pages per upload, giving roughly 50 feed reads per write before counting image deliveries. The design should scale feed reads independently, cache popular feed data, and serve photo bytes through a CDN rather than sending every image request through application servers.

## Architecture

```text
                         +------------------+
                         |      Clients     |
                         +--------+---------+
                                  |
                   feed/images   |   API/upload requests
                         +--------v---------+
                         |       CDN        |
                         +--------+---------+
                                  |
                         +--------v---------+
                         |  Load balancer   |
                         +--------+---------+
                                  |
                         +--------v---------+
                         |   App servers    |
                         +---+----------+---+
                             |          |
                  feed data  |          | enqueue thumbnail job
                  +----------v--+   +---v-----------+
                  |    Cache    |   |    Queue      |
                  +------+-----+   +---+-----------+
                         |             | worker consumes job
                         |             v
                  +------v------+  +---+-----------+
                  |  Database   |  | Thumbnail     |
                  |  primary    |  | worker        |
                  +--+-------+--+  +---+-----------+
                     |       |         |
          replication |       |         | read/write photo files
                     v       |         v
               +-----+----+  |  +------+----------+
               | Read      |  +->| Object storage |
               | replica   |     | originals and  |
               +----------+     | thumbnails      |
                                +-----------------+
```

### Components

- **Clients** upload photos and request feed data and images.
- **CDN** caches and delivers photo files close to users, reducing image latency and origin bandwidth.
- **Load balancer** distributes API traffic across healthy app servers and avoids making one server the bottleneck.
- **App servers** authenticate requests, coordinate uploads, serve feed metadata, and enqueue thumbnail work.
- **Cache** holds frequently requested feed data and metadata to reduce repeated database reads.
- **Database primary** stores users, follow relationships, photo metadata, and feed-related records as the authoritative write source.
- **Database read replica** serves scalable read queries without routing all feed reads to the primary, with some possible replication delay.
- **Object storage** stores original photos and generated thumbnails durably and independently of the relational database.
- **Queue** buffers thumbnail jobs so bursts of uploads do not overwhelm image processing.
- **Thumbnail worker** consumes queued jobs, creates the 50 KB thumbnail, stores it in object storage, and marks the photo ready in the database.

Photo files belong in object storage, not inside the database: large binary objects would inflate database size and backups, consume resources needed for transactional queries, and make file delivery and independent storage scaling harder. Keep only metadata and object keys in the database, then deliver the files through the CDN.

## Photo Upload Flow

1. The client requests an upload from the app server; the server authenticates the user and creates a photo record with a pending-processing status.
2. The app server returns an authorized, short-lived object-storage upload URL, and the client uploads the original photo directly to object storage.
3. After the upload completes, the client notifies the app server, which verifies the stored object and enqueues a thumbnail job containing the photo ID and object key.
4. A thumbnail worker takes the job, reads the original from object storage, creates the 50 KB thumbnail, and writes it back to object storage.
5. The worker updates the photo metadata to indicate the thumbnail is ready; the photo can then appear in feeds, and the CDN can fetch and cache the original and thumbnail on demand.

## Trade-offs

- **Direct uploads versus proxying through app servers:** Presigned direct uploads reduce app-server bandwidth and scale better for large files, but require careful URL expiry, upload authorization, and completion verification; proxying is simpler to control but uses more app-server resources.
- **Asynchronous thumbnails versus synchronous processing:** A queue absorbs bursts and keeps upload requests fast, but thumbnails are not immediately available and users may briefly see a pending state; synchronous work gives immediate results but increases upload latency and makes processing spikes affect request availability.
- **Read replicas and caching versus freshest data:** Replicas and caches reduce primary-database load and help meet peak feed demand, but replication lag or stale cache entries can briefly hide new photos or follow changes; stronger freshness requires more invalidation or primary reads and can reduce scalability.