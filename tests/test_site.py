import json
import unittest
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.tags = []
        self.schemas = []
        self.schema_text = None
        self.text = path.read_text(encoding='utf-8')
        self.feed(self.text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.schema_text = ''

    def handle_data(self, data):
        if self.schema_text is not None:
            self.schema_text += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.schema_text is not None:
            self.schemas.append(json.loads(self.schema_text))
            self.schema_text = None

    def select(self, tag):
        return [attrs for name, attrs in self.tags if name == tag]


class SiteIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = {path: Document(path) for path in ROOT.rglob('*.html')}

    def test_page_metadata_and_ids(self):
        for path, doc in self.pages.items():
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertEqual(len(doc.select('h1')), 1)
                self.assertEqual(len(doc.select('title')), 1)
                self.assertTrue(any(m.get('name') == 'viewport' for m in doc.select('meta')))
                ids = Counter(a['id'] for _, a in doc.tags if 'id' in a)
                self.assertFalse([key for key, count in ids.items() if count > 1])
                self.assertNotIn('placeholder content', doc.text)
                self.assertNotIn('21 dni', doc.text)
                self.assertNotIn('\ufffd', doc.text)

    def test_local_links_and_assets_exist(self):
        for path, doc in self.pages.items():
            for tag, attr in [('a', 'href'), ('img', 'src'), ('script', 'src'), ('link', 'href')]:
                for node in doc.select(tag):
                    url = urlsplit(node.get(attr, ''))
                    if url.scheme or not url.path.startswith('/115/'):
                        continue
                    target = ROOT / unquote(url.path.removeprefix('/115/'))
                    with self.subTest(page=path.relative_to(ROOT), target=url.path):
                        self.assertTrue(target.exists())
                        if target.is_dir():
                            self.assertTrue((target / 'index.html').is_file())
                        if url.fragment and target.is_file() and target.suffix == '.html':
                            self.assertIn(url.fragment, [a.get('id') for _, a in self.pages[target].tags])

    def test_product_variants_match_schema(self):
        products = [p for p in self.pages if p.parent.parent.name == 'products']
        self.assertEqual(len(products), 27)
        for path in products:
            doc = self.pages[path]
            with self.subTest(product=path.parent.name):
                data = doc.schemas[0]
                variants = data.get('hasVariant') or [data]
                prices = {v['sku']: float(v['offers']['price']) for v in variants}
                choices = {o['value']: float(o['data-price']) for o in doc.select('option') if o.get('value')}
                self.assertEqual(choices, prices)
                self.assertNotIn('schema.org/InStock', doc.text)
                self.assertNotIn('/de/cart/add', doc.text)
                self.assertTrue(any('data-order-form' in f for f in doc.select('form')))
                self.assertTrue(any(b.get('type') == 'submit' and 'disabled' in b for b in doc.select('button')))

    def test_search_covers_every_product(self):
        doc = self.pages[ROOT / 'search/index.html']
        links = {a['href'] for a in doc.select('a') if a.get('href', '').startswith('/115/products/')}
        expected = {'/115/' + p.parent.relative_to(ROOT).as_posix() + '/' for p in self.pages if p.parent.parent.name == 'products'}
        self.assertEqual(links, expected)

    def test_sitemap_covers_index_pages(self):
        tree = ElementTree.parse(ROOT / 'sitemap.xml')
        locations = {n.text for n in tree.findall('.//{*}loc')}
        expected = {'https://vibe-sites-pl.github.io/115/' + ('' if p == ROOT / 'index.html' else p.parent.relative_to(ROOT).as_posix() + '/') for p in self.pages if p.name == 'index.html'}
        self.assertEqual(locations, expected)


if __name__ == '__main__':
    unittest.main()
