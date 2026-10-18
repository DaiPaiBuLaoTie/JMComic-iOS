import { combineReducers } from "redux";
import blogsFeature from "../reducers/blogsFeature";
import categoriesFeature from "../reducers/categoriesFeature";
import contactFeature from "../reducers/contactFeature";
import creatorFeature from "../reducers/creatorFeature";
import detailFeature from "../reducers/detailFeature";
import forumFeature from "../reducers/forumFeature";
import gamesFeature from "../reducers/gamesFeature";
import hotUpdateFeature from "../reducers/hotUpdateFeature";
import mainFeature from "../reducers/mainFeature";
import memberFeature from "../reducers/memberFeature";
import moviesPlayerFeature from "../reducers/moviesPlayerFeature";
import moviesFeature from "../reducers/moviesFeature";
import novelFeature from "../reducers/novelFeature";
import searchFeature from "../reducers/searchFeature";
import settingsFeature from "../reducers/settingsFeature";
import weekFeature from "../reducers/weekFeature";
const rootFeature = combineReducers({
  hotUpdate: hotUpdateFeature,
  settings: settingsFeature,
  main: mainFeature,
  detail: detailFeature,
  forum: forumFeature,
  search: searchFeature,
  week: weekFeature,
  blogs: blogsFeature,
  creator: creatorFeature,
  categories: categoriesFeature,
  member: memberFeature,
  games: gamesFeature,
  movies: moviesFeature,
  MoviesPlayer: moviesPlayerFeature,
  novel: novelFeature,
  contact: contactFeature
});
export default rootFeature;
